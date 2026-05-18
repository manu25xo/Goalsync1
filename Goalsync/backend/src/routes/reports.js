const router = require('express').Router();
const pool = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET /api/reports/audit — paginated audit log (admin/manager)
router.get('/audit', authMiddleware, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50, goalId, userId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = [], params = [], i = 1;

    if (goalId) { where.push(`al.goal_id = $${i++}`); params.push(goalId); }
    if (userId) { where.push(`al.user_id = $${i++}`); params.push(userId); }
    if (req.user.role === 'manager') {
      where.push(`u.manager_id = $${i++}`); params.push(req.user.id);
    }

    params.push(parseInt(limit), offset);

    const { rows } = await pool.query(`
      SELECT al.*, actor.name AS actor_name, actor.role AS actor_role,
        g.title AS goal_title, emp.name AS employee_name
      FROM audit_log al
      LEFT JOIN users actor ON al.user_id = actor.id
      LEFT JOIN goals g ON al.goal_id = g.id
      LEFT JOIN users emp ON g.employee_id = emp.id
      LEFT JOIN users u ON g.employee_id = u.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY al.created_at DESC
      LIMIT $${i++} OFFSET $${i}
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/reports/achievement — org-wide achievement summary
router.get('/achievement', authMiddleware, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const managerFilter = req.user.role === 'manager'
      ? `AND u.manager_id = '${req.user.id}'` : '';

    const { rows } = await pool.query(`
      SELECT
        u.id AS employee_id, u.name AS employee_name, u.department,
        m.name AS manager_name,
        g.id AS goal_id, g.title, g.thrust_area, g.uom, g.target_value,
        g.weightage, g.status, g.progress_status,
        MAX(CASE WHEN a.quarter = 'Q1' THEN a.actual_value END) AS q1_actual,
        MAX(CASE WHEN a.quarter = 'Q2' THEN a.actual_value END) AS q2_actual,
        MAX(CASE WHEN a.quarter = 'Q3' THEN a.actual_value END) AS q3_actual,
        MAX(CASE WHEN a.quarter = 'Q4' THEN a.actual_value END) AS q4_actual,
        MAX(CASE WHEN a.quarter = 'Q1' THEN a.score_pct END) AS q1_score,
        MAX(CASE WHEN a.quarter = 'Q2' THEN a.score_pct END) AS q2_score,
        MAX(CASE WHEN a.quarter = 'Q3' THEN a.score_pct END) AS q3_score,
        MAX(CASE WHEN a.quarter = 'Q4' THEN a.score_pct END) AS q4_score
      FROM goals g
      JOIN users u ON g.employee_id = u.id
      LEFT JOIN users m ON u.manager_id = m.id
      LEFT JOIN achievements a ON a.goal_id = g.id
      WHERE g.status = 'approved' ${managerFilter}
      GROUP BY u.id, u.name, u.department, m.name, g.id, g.title, g.thrust_area, g.uom, g.target_value, g.weightage, g.status, g.progress_status
      ORDER BY u.name, g.title
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/reports/achievement/csv — CSV export
router.get('/achievement/csv', authMiddleware, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const managerFilter = req.user.role === 'manager'
      ? `AND u.manager_id = '${req.user.id}'` : '';

    const { rows } = await pool.query(`
      SELECT u.name AS employee, u.department, m.name AS manager,
        g.title AS goal, g.thrust_area, g.uom, g.target_value AS target,
        g.weightage, g.status, g.progress_status,
        MAX(CASE WHEN a.quarter='Q1' THEN a.actual_value END) q1_actual,
        MAX(CASE WHEN a.quarter='Q2' THEN a.actual_value END) q2_actual,
        MAX(CASE WHEN a.quarter='Q3' THEN a.actual_value END) q3_actual,
        MAX(CASE WHEN a.quarter='Q4' THEN a.actual_value END) q4_actual,
        MAX(CASE WHEN a.quarter='Q1' THEN a.score_pct END) q1_score,
        MAX(CASE WHEN a.quarter='Q2' THEN a.score_pct END) q2_score,
        MAX(CASE WHEN a.quarter='Q3' THEN a.score_pct END) q3_score,
        MAX(CASE WHEN a.quarter='Q4' THEN a.score_pct END) q4_score
      FROM goals g JOIN users u ON g.employee_id = u.id
      LEFT JOIN users m ON u.manager_id = m.id
      LEFT JOIN achievements a ON a.goal_id = g.id
      WHERE 1=1 ${managerFilter}
      GROUP BY u.name, u.department, m.name, g.title, g.thrust_area, g.uom, g.target_value, g.weightage, g.status, g.progress_status
      ORDER BY u.name
    `);

    const headers = ['Employee','Department','Manager','Goal','Thrust Area','UoM','Target','Weightage','Status','Progress',
      'Q1 Actual','Q2 Actual','Q3 Actual','Q4 Actual','Q1 Score%','Q2 Score%','Q3 Score%','Q4 Score%'];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.employee, r.department, r.manager || '', `"${r.goal}"`, r.thrust_area,
        r.uom, r.target, r.weightage, r.status, r.progress_status,
        r.q1_actual || '', r.q2_actual || '', r.q3_actual || '', r.q4_actual || '',
        r.q1_score || '', r.q2_score || '', r.q3_score || '', r.q4_score || ''
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="achievement_report_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/reports/dashboard — summary stats
router.get('/dashboard', authMiddleware, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const managerFilter = req.user.role === 'manager' ? `AND u.manager_id = '${req.user.id}'` : '';
    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'employee' ${managerFilter.replace('AND u.','AND u.')}) AS total_employees,
        COUNT(g.id) AS total_goals,
        COUNT(g.id) FILTER (WHERE g.status = 'approved') AS approved_goals,
        COUNT(g.id) FILTER (WHERE g.status = 'pending') AS pending_goals,
        COUNT(g.id) FILTER (WHERE g.status = 'draft') AS draft_goals,
        COUNT(g.id) FILTER (WHERE g.progress_status = 'At Risk') AS at_risk,
        COUNT(g.id) FILTER (WHERE g.progress_status = 'Completed') AS completed,
        ROUND(AVG(a.score_pct) FILTER (WHERE a.quarter = 'Q2'), 2) AS avg_q2_score
      FROM users u
      LEFT JOIN goals g ON g.employee_id = u.id
      LEFT JOIN achievements a ON a.goal_id = g.id
      WHERE u.is_active = TRUE AND u.role = 'employee'
        ${managerFilter}
    `);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
