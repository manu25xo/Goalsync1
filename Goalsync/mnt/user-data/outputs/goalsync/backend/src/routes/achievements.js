const router = require('express').Router();
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { computeScore } = require('../utils/scores');

// GET /api/achievements?goalId=xxx
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { goalId } = req.query;
    if (!goalId) return res.status(400).json({ error: 'goalId required' });

    // Check access
    const { rows: goalRows } = await pool.query('SELECT * FROM goals WHERE id = $1', [goalId]);
    if (!goalRows.length) return res.status(404).json({ error: 'Goal not found' });
    const goal = goalRows[0];

    if (req.user.role === 'employee' && goal.employee_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'manager') {
      const { rows } = await pool.query(
        'SELECT 1 FROM users WHERE id = $1 AND manager_id = $2', [goal.employee_id, req.user.id]
      );
      if (!rows.length && goal.employee_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM achievements WHERE goal_id = $1 ORDER BY quarter', [goalId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PUT /api/achievements/:goalId/:quarter — upsert actual value
router.put('/:goalId/:quarter', authMiddleware, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { goalId, quarter } = req.params;
    const { actualValue, progressStatus } = req.body;

    if (!['Q1','Q2','Q3','Q4'].includes(quarter)) {
      return res.status(400).json({ error: 'Quarter must be Q1–Q4' });
    }

    const { rows: goalRows } = await client.query('SELECT * FROM goals WHERE id = $1', [goalId]);
    if (!goalRows.length) return res.status(404).json({ error: 'Goal not found' });
    const goal = goalRows[0];

    // Only owner or manager/admin can update
    const isOwner = goal.employee_id === req.user.id;
    if (!isOwner && req.user.role === 'employee') return res.status(403).json({ error: 'Forbidden' });
    if (goal.status !== 'approved') return res.status(400).json({ error: 'Only approved goals can be updated' });

    // Check cycle window — simplified: always allow in dev
    const score = computeScore(goal.uom, goal.target_value, actualValue);

    const { rows } = await client.query(
      `INSERT INTO achievements (goal_id, quarter, actual_value, score_pct, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (goal_id, quarter) DO UPDATE
         SET actual_value = $3, score_pct = $4, updated_by = $5, updated_at = NOW()
       RETURNING *`,
      [goalId, quarter, actualValue, score, req.user.id]
    );

    // Update progress status if provided
    if (progressStatus) {
      await client.query(
        `UPDATE goals SET progress_status = $1, updated_at = NOW() WHERE id = $2`,
        [progressStatus, goalId]
      );
    }

    await client.query(
      `INSERT INTO audit_log (goal_id, user_id, action, detail)
       VALUES ($1, $2, $3, $4)`,
      [goalId, req.user.id, `${quarter} Achievement updated`,
       `actual: ${actualValue}, score: ${score !== null ? score + '%' : 'N/A'}`]
    );

    await client.query('COMMIT');
    res.json({ ...rows[0], progress_status: progressStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

module.exports = router;
