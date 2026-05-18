const router = require('express').Router();
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { computeScore } = require('../utils/scores');

// ── helpers ───────────────────────────────────────────────────────────────────
async function getGoalOr404(goalId, client) {
  const { rows } = await (client || pool).query('SELECT * FROM goals WHERE id = $1', [goalId]);
  return rows[0] || null;
}

async function validateWeightage(employeeId, newWeight, excludeGoalId, client) {
  const { rows } = await (client || pool).query(
    `SELECT COALESCE(SUM(weightage), 0) AS total FROM goals
     WHERE employee_id = $1 AND id != $2`,
    [employeeId, excludeGoalId || '00000000-0000-0000-0000-000000000000']
  );
  const existing = parseFloat(rows[0].total);
  return existing + parseFloat(newWeight);
}

async function logAudit(client, goalId, userId, action, detail, before, after) {
  await client.query(
    `INSERT INTO audit_log (goal_id, user_id, action, detail, before_data, after_data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [goalId, userId, action, detail, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]
  );
}

// ── GET /api/goals — list goals (scoped by role) ──────────────────────────────
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { employeeId, status, cycleId } = req.query;
    let where = [];
    let params = [];
    let i = 1;

    if (req.user.role === 'employee') {
      where.push(`g.employee_id = $${i++}`);
      params.push(req.user.id);
    } else if (req.user.role === 'manager') {
      if (employeeId) {
        // Check that this employee reports to this manager
        where.push(`g.employee_id = $${i++}`);
        params.push(employeeId);
      } else {
        where.push(`u.manager_id = $${i++}`);
        params.push(req.user.id);
      }
    } else if (employeeId) {
      where.push(`g.employee_id = $${i++}`);
      params.push(employeeId);
    }

    if (status) { where.push(`g.status = $${i++}`); params.push(status); }
    if (cycleId) { where.push(`g.cycle_id = $${i++}`); params.push(cycleId); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await pool.query(`
      SELECT g.*,
        u.name AS employee_name, u.department, u.email AS employee_email,
        sf.name AS shared_from_name,
        json_agg(DISTINCT jsonb_build_object(
          'id', a.id, 'quarter', a.quarter, 'actual_value', a.actual_value, 'score_pct', a.score_pct
        )) FILTER (WHERE a.id IS NOT NULL) AS achievements,
        json_agg(DISTINCT jsonb_build_object(
          'id', cc.id, 'quarter', cc.quarter, 'comment', cc.comment,
          'manager_id', cc.manager_id, 'created_at', cc.created_at
        )) FILTER (WHERE cc.id IS NOT NULL) AS checkin_comments
      FROM goals g
      JOIN users u ON g.employee_id = u.id
      LEFT JOIN users sf ON g.shared_from = sf.id
      LEFT JOIN achievements a ON a.goal_id = g.id
      LEFT JOIN checkin_comments cc ON cc.goal_id = g.id
      ${whereClause}
      GROUP BY g.id, u.name, u.department, u.email, sf.name
      ORDER BY g.created_at DESC
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /api/goals — create goal ─────────────────────────────────────────────
router.post('/', authMiddleware, requireRole('employee', 'manager', 'admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, description, thrustArea, uom, targetValue, weightage, cycleId } = req.body;
    const employeeId = req.user.role === 'employee' ? req.user.id : req.body.employeeId || req.user.id;

    // Validation
    if (!title || !thrustArea || !uom || !weightage) {
      return res.status(400).json({ error: 'title, thrustArea, uom, weightage are required' });
    }
    if (parseFloat(weightage) < 10) return res.status(400).json({ error: 'Minimum weightage is 10%' });

    // Max 8 goals check
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) FROM goals WHERE employee_id = $1`, [employeeId]
    );
    if (parseInt(countRows[0].count) >= 8) {
      return res.status(400).json({ error: 'Maximum 8 goals allowed per employee' });
    }

    // Weightage total check
    const newTotal = await validateWeightage(employeeId, weightage, null, client);
    if (newTotal > 100) {
      return res.status(400).json({ error: `Total weightage would be ${newTotal}% (max 100%)` });
    }

    const { rows } = await client.query(
      `INSERT INTO goals (employee_id, cycle_id, title, description, thrust_area, uom, target_value, weightage, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
       RETURNING *`,
      [employeeId, cycleId || null, title, description, thrustArea, uom,
       uom === 'Zero' ? '0' : targetValue, parseFloat(weightage)]
    );

    await logAudit(client, rows[0].id, req.user.id, 'Goal created', `Title: ${title}`);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── PATCH /api/goals/:id — update goal ───────────────────────────────────────
router.patch('/:id', authMiddleware, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const goal = await getGoalOr404(req.params.id, client);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const isOwner = goal.employee_id === req.user.id;
    const isManager = req.user.role === 'manager';
    const isAdmin = req.user.role === 'admin';

    // Locked goals can only be edited by admin or manager during approval
    if (goal.locked_at && !isAdmin && !(isManager && goal.status === 'pending')) {
      return res.status(403).json({ error: 'Goal is locked. Contact admin to unlock.' });
    }
    if (!isOwner && !isManager && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const before = { ...goal };
    const { title, description, thrustArea, uom, targetValue, weightage, progressStatus } = req.body;

    // For shared goals, employee can only change weightage
    if (goal.is_shared && isOwner && !isManager && !isAdmin) {
      if (title || description || thrustArea || uom || targetValue) {
        return res.status(403).json({ error: 'Shared goal: only weightage can be changed' });
      }
    }

    if (weightage !== undefined) {
      const newTotal = await validateWeightage(goal.employee_id, weightage, goal.id, client);
      if (newTotal > 100) return res.status(400).json({ error: `Total weightage would be ${newTotal}%` });
      if (parseFloat(weightage) < 10) return res.status(400).json({ error: 'Minimum weightage is 10%' });
    }

    const { rows } = await client.query(
      `UPDATE goals SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         thrust_area = COALESCE($3, thrust_area),
         uom = COALESCE($4, uom),
         target_value = COALESCE($5, target_value),
         weightage = COALESCE($6, weightage),
         progress_status = COALESCE($7, progress_status),
         updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [title, description, thrustArea, uom, targetValue, weightage && parseFloat(weightage), progressStatus, goal.id]
    );

    await logAudit(client, goal.id, req.user.id, 'Goal updated', null, before, rows[0]);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── POST /api/goals/:id/submit ────────────────────────────────────────────────
router.post('/:id/submit', authMiddleware, requireRole('employee'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const goal = await getGoalOr404(req.params.id, client);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.employee_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['draft', 'rework'].includes(goal.status)) {
      return res.status(400).json({ error: 'Only draft/rework goals can be submitted' });
    }

    // Validate total weightage equals 100
    const { rows: wRows } = await client.query(
      `SELECT COALESCE(SUM(weightage), 0) AS total FROM goals WHERE employee_id = $1`,
      [req.user.id]
    );
    if (parseFloat(wRows[0].total) !== 100) {
      return res.status(400).json({ error: `Total weightage must equal 100% (current: ${wRows[0].total}%)` });
    }

    const { rows } = await client.query(
      `UPDATE goals SET status = 'pending', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [goal.id]
    );
    await logAudit(client, goal.id, req.user.id, 'Goal submitted for approval');
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── POST /api/goals/:id/approve ───────────────────────────────────────────────
router.post('/:id/approve', authMiddleware, requireRole('manager', 'admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const goal = await getGoalOr404(req.params.id, client);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    // Manager can only approve goals of their direct reports
    if (req.user.role === 'manager') {
      const { rows } = await client.query(
        `SELECT 1 FROM users WHERE id = $1 AND manager_id = $2`, [goal.employee_id, req.user.id]
      );
      if (!rows.length) return res.status(403).json({ error: 'Not your team member' });
    }

    const { rows } = await client.query(
      `UPDATE goals SET status = 'approved', locked_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [goal.id]
    );
    await logAudit(client, goal.id, req.user.id, 'Goal approved', req.body.comment || '');
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── POST /api/goals/:id/reject ────────────────────────────────────────────────
router.post('/:id/reject', authMiddleware, requireRole('manager', 'admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const goal = await getGoalOr404(req.params.id, client);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const newStatus = req.body.returnForRework ? 'rework' : 'rejected';
    const { rows } = await client.query(
      `UPDATE goals SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, goal.id]
    );
    await logAudit(client, goal.id, req.user.id, newStatus === 'rework' ? 'Returned for rework' : 'Goal rejected', req.body.reason || '');
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── POST /api/goals/:id/unlock — admin only ───────────────────────────────────
router.post('/:id/unlock', authMiddleware, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE goals SET status = 'draft', locked_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Goal not found' });
    await logAudit(client, req.params.id, req.user.id, 'Goal unlocked by Admin', req.body.reason || 'Exception unlock');
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── POST /api/goals/shared — push shared goal ─────────────────────────────────
router.post('/shared', authMiddleware, requireRole('manager', 'admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, description, thrustArea, uom, targetValue, recipientIds, cycleId } = req.body;
    if (!recipientIds || !recipientIds.length) return res.status(400).json({ error: 'Recipients required' });

    const created = [];
    for (const uid of recipientIds) {
      const { rows: countRows } = await client.query('SELECT COUNT(*) FROM goals WHERE employee_id = $1', [uid]);
      if (parseInt(countRows[0].count) >= 8) continue; // Skip if at max

      const { rows } = await client.query(
        `INSERT INTO goals (employee_id, cycle_id, title, description, thrust_area, uom, target_value, weightage, status, is_shared, shared_from)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 10, 'draft', TRUE, $8) RETURNING *`,
        [uid, cycleId || null, title, description, thrustArea, uom, uom === 'Zero' ? '0' : targetValue, req.user.id]
      );
      await logAudit(client, rows[0].id, req.user.id, 'Shared goal pushed', `To employee: ${uid}`);
      created.push(rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── DELETE /api/goals/:id — only draft goals by owner or admin ────────────────
router.delete('/:id', authMiddleware, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const goal = await getGoalOr404(req.params.id, client);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const isOwner = goal.employee_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });
    if (goal.status !== 'draft' && !isAdmin) return res.status(400).json({ error: 'Only draft goals can be deleted' });

    await client.query('DELETE FROM goals WHERE id = $1', [goal.id]);
    await client.query('COMMIT');
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

module.exports = router;
