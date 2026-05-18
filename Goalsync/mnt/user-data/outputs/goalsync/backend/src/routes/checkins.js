const router = require('express').Router();
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET /api/checkins?goalId=xxx
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { goalId, employeeId } = req.query;
    let where = [], params = [], i = 1;

    if (goalId) { where.push(`cc.goal_id = $${i++}`); params.push(goalId); }
    if (employeeId && req.user.role !== 'employee') {
      where.push(`g.employee_id = $${i++}`); params.push(employeeId);
    } else if (req.user.role === 'employee') {
      where.push(`g.employee_id = $${i++}`); params.push(req.user.id);
    }

    const { rows } = await pool.query(`
      SELECT cc.*, m.name AS manager_name, g.title AS goal_title, g.employee_id
      FROM checkin_comments cc
      JOIN users m ON cc.manager_id = m.id
      JOIN goals g ON cc.goal_id = g.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY cc.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/checkins
router.post('/', authMiddleware, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { goalId, quarter, comment } = req.body;
    if (!goalId || !quarter || !comment?.trim()) {
      return res.status(400).json({ error: 'goalId, quarter, comment are required' });
    }

    // Verify access
    if (req.user.role === 'manager') {
      const { rows } = await pool.query(
        `SELECT 1 FROM goals g JOIN users u ON g.employee_id = u.id
         WHERE g.id = $1 AND u.manager_id = $2`, [goalId, req.user.id]
      );
      if (!rows.length) return res.status(403).json({ error: 'Not your team member\'s goal' });
    }

    const { rows } = await pool.query(
      `INSERT INTO checkin_comments (goal_id, manager_id, quarter, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [goalId, req.user.id, quarter, comment.trim()]
    );

    await pool.query(
      `INSERT INTO audit_log (goal_id, user_id, action, detail) VALUES ($1, $2, $3, $4)`,
      [goalId, req.user.id, `${quarter} Check-in comment added`, comment.substring(0, 100)]
    );

    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/checkins/:id — manager deletes own comment
router.delete('/:id', authMiddleware, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM checkin_comments WHERE id = $1 AND (manager_id = $2 OR $3 = 'admin') RETURNING id`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!rows.length) return res.status(404).json({ error: 'Comment not found or not yours' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
