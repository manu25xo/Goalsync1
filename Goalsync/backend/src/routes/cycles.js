const router = require('express').Router();
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET /api/cycles
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.name AS created_by_name
       FROM cycles c LEFT JOIN users u ON c.created_by = u.id
       ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/cycles/active
router.get('/active', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM cycles WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1`
    );
    res.json(rows[0] || null);
  } catch (err) { next(err); }
});

// POST /api/cycles — admin only
router.post('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, fiscalYear, phase, windowOpen, windowClose } = req.body;
    if (!name || !fiscalYear || !phase || !windowOpen || !windowClose) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO cycles (name, fiscal_year, phase, window_open, window_close, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6) RETURNING *`,
      [name, fiscalYear, phase, windowOpen, windowClose, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/cycles/:id/activate — admin only
router.patch('/:id/activate', authMiddleware, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE cycles SET is_active = FALSE');
    const { rows } = await client.query(
      `UPDATE cycles SET is_active = TRUE WHERE id = $1 RETURNING *`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cycle not found' });
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

module.exports = router;
