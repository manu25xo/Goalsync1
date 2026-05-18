const router = require('express').Router();
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET /api/users — admin: all users; manager: team + self; employee: self
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query = `SELECT u.id, u.name, u.email, u.role, u.department, u.manager_id, u.is_active,
                 m.name AS manager_name
               FROM users u LEFT JOIN users m ON u.manager_id = m.id
               ORDER BY u.role, u.name`;
      params = [];
    } else if (req.user.role === 'manager') {
      query = `SELECT u.id, u.name, u.email, u.role, u.department, u.manager_id, u.is_active,
                 m.name AS manager_name
               FROM users u LEFT JOIN users m ON u.manager_id = m.id
               WHERE u.manager_id = $1 OR u.id = $1
               ORDER BY u.role, u.name`;
      params = [req.user.id];
    } else {
      query = `SELECT id, name, email, role, department, manager_id, is_active FROM users WHERE id = $1`;
      params = [req.user.id];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/users/team — manager gets their team
router.get('/team', authMiddleware, requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const managerId = req.user.role === 'admin' ? null : req.user.id;
    const { rows } = await pool.query(
      managerId
        ? `SELECT id, name, email, role, department FROM users WHERE manager_id = $1 AND is_active = TRUE ORDER BY name`
        : `SELECT id, name, email, role, department, manager_id FROM users WHERE role = 'employee' AND is_active = TRUE ORDER BY name`,
      managerId ? [managerId] : []
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/users — admin creates users
router.post('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role, department, managerId } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Required fields missing' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, department, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, department, manager_id`,
      [name, email.toLowerCase(), hash, role, department, managerId || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    next(err);
  }
});

// PATCH /api/users/:id — admin updates user
router.patch('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, department, managerId, role, isActive } = req.body;
    const { rows } = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), department = COALESCE($2, department),
         manager_id = COALESCE($3, manager_id), role = COALESCE($4, role),
         is_active = COALESCE($5, is_active), updated_at = NOW()
       WHERE id = $6 RETURNING id, name, email, role, department, manager_id, is_active`,
      [name, department, managerId, role, isActive, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
