require('dotenv').config();
const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');
    await client.query('BEGIN');

    // Clear tables
    await client.query('DELETE FROM audit_log');
    await client.query('DELETE FROM checkin_comments');
    await client.query('DELETE FROM achievements');
    await client.query('DELETE FROM goals');
    await client.query('DELETE FROM cycles');
    await client.query('DELETE FROM users');

    const hash = await bcrypt.hash('password123', 10);

    // Insert users
    const { rows: users } = await client.query(`
      INSERT INTO users (name, email, password_hash, role, department) VALUES
        ('Divya Nair',    'admin@company.com',   $1, 'admin',    'HR'),
        ('Rahul Verma',   'manager1@company.com', $1, 'manager',  'Engineering'),
        ('Amit Kapoor',   'manager2@company.com', $1, 'manager',  'Sales'),
        ('Arjun Sharma',  'emp1@company.com',     $1, 'employee', 'Engineering'),
        ('Priya Mehta',   'emp2@company.com',     $1, 'employee', 'Engineering'),
        ('Sneha Patel',   'emp3@company.com',     $1, 'employee', 'Sales')
      RETURNING id, name, email, role
    `, [hash]);

    const byEmail = {};
    users.forEach(u => { byEmail[u.email] = u.id; });

    // Set manager relationships
    await client.query('UPDATE users SET manager_id = $1 WHERE email IN ($2, $3)',
      [byEmail['manager1@company.com'], 'emp1@company.com', 'emp2@company.com']);
    await client.query('UPDATE users SET manager_id = $1 WHERE email = $2',
      [byEmail['manager2@company.com'], 'emp3@company.com']);

    // Insert cycle
    const { rows: [cycle] } = await client.query(`
      INSERT INTO cycles (name, fiscal_year, phase, window_open, window_close, is_active, created_by)
      VALUES ('FY 2025-26', '2025-26', 'q2', '2025-10-01', '2025-10-31', TRUE, $1)
      RETURNING id
    `, [byEmail['admin@company.com']]);

    // Insert goals for Arjun (emp1)
    const arjunGoals = await client.query(`
      INSERT INTO goals (employee_id, cycle_id, title, description, thrust_area, uom, target_value, weightage, status, progress_status, locked_at)
      VALUES
        ($1, $2, 'Increase Code Coverage to 80%',      'Improve unit test coverage across all microservices', 'Operational Excellence', 'Numeric',  '80',          30, 'approved', 'On Track',   NOW() - interval '30 days'),
        ($1, $2, 'Deploy 3 Microservices to Production','Migrate legacy services to cloud-native architecture', 'Innovation',            'Numeric',  '3',           25, 'approved', 'On Track',   NOW() - interval '30 days'),
        ($1, $2, 'Reduce Incident Resolution TAT',      'Bring average resolution time under 4 hours',         'Customer Satisfaction', 'Max',      '4',           20, 'approved', 'On Track',   NOW() - interval '30 days'),
        ($1, $2, 'Complete AWS Solutions Architect Cert','Pass the AWS SAA-C03 exam',                          'People Development',    'Timeline', '2025-12-31',  15, 'approved', 'Not Started',NOW() - interval '30 days'),
        ($1, $2, 'Zero Production Security Incidents',  'No P0/P1 security breaches in production',           'Quality & Compliance',  'Zero',     '0',           10, 'approved', 'On Track',   NOW() - interval '30 days')
      RETURNING id
    `, [byEmail['emp1@company.com'], cycle.id]);

    // Insert goals for Priya (emp2)
    const priyaGoals = await client.query(`
      INSERT INTO goals (employee_id, cycle_id, title, description, thrust_area, uom, target_value, weightage, status, progress_status)
      VALUES
        ($1, $2, 'Launch New API Gateway',       'Release v2 API gateway with rate limiting',  'Innovation',            'Numeric', '1',   40, 'pending',   'Not Started'),
        ($1, $2, 'Achieve 95% Sprint Velocity',  'Maintain sprint completion above 95%',        'Operational Excellence','Numeric', '95',  35, 'pending',   'Not Started'),
        ($1, $2, 'Customer Satisfaction Score ≥ 4.5','CSAT rating from internal stakeholders', 'Customer Satisfaction', 'Numeric', '4.5', 25, 'pending',   'Not Started')
      RETURNING id
    `, [byEmail['emp2@company.com'], cycle.id]);

    // Insert goals for Sneha (emp3)
    const snehaGoals = await client.query(`
      INSERT INTO goals (employee_id, cycle_id, title, description, thrust_area, uom, target_value, weightage, status, progress_status, locked_at)
      VALUES
        ($1, $2, 'Achieve ₹50L Revenue Target',    'Q4 sales target for enterprise accounts',    'Revenue Growth',        'Numeric', '50', 50, 'approved', 'On Track', NOW() - interval '25 days'),
        ($1, $2, 'Onboard 5 New Enterprise Clients','Signed contracts with enterprise segment',   'Revenue Growth',        'Numeric', '5',  30, 'approved', 'On Track', NOW() - interval '25 days'),
        ($1, $2, 'Zero Compliance Violations',      'No regulatory/compliance issues in sales',   'Quality & Compliance',  'Zero',    '0',  20, 'approved', 'On Track', NOW() - interval '25 days')
      RETURNING id
    `, [byEmail['emp3@company.com'], cycle.id]);

    // Q1 + Q2 achievements for Arjun
    const arjunIds = arjunGoals.rows.map(r => r.id);
    await client.query(`
      INSERT INTO achievements (goal_id, quarter, actual_value, score_pct, updated_by) VALUES
        ($1, 'Q1', '65',   81.25, $6),  ($1, 'Q2', '72',   90.00, $6),
        ($2, 'Q1', '1',    33.33, $6),  ($2, 'Q2', '2',    66.67, $6),
        ($3, 'Q1', '6',    66.67, $6),  ($3, 'Q2', '5',    80.00, $6),
        ($4, 'Q1', NULL,   NULL,  $6),
        ($5, 'Q1', '0',   100.00, $6),  ($5, 'Q2', '0',   100.00, $6)
    `, [...arjunIds, byEmail['emp1@company.com']]);

    // Q1 + Q2 achievements for Sneha
    const snehaIds = snehaGoals.rows.map(r => r.id);
    await client.query(`
      INSERT INTO achievements (goal_id, quarter, actual_value, score_pct, updated_by) VALUES
        ($1, 'Q1', '12',  24.00, $4),  ($1, 'Q2', '28',  56.00, $4),
        ($2, 'Q1', '1',   20.00, $4),  ($2, 'Q2', '3',   60.00, $4),
        ($3, 'Q1', '0',  100.00, $4),  ($3, 'Q2', '0',  100.00, $4)
    `, [...snehaIds, byEmail['emp3@company.com']]);

    // Check-in comments
    await client.query(`
      INSERT INTO checkin_comments (goal_id, manager_id, quarter, comment) VALUES
        ($1, $3, 'Q2', 'Good progress. Aim to reach 78% by Q3. Keep the momentum going.'),
        ($2, $4, 'Q2', 'On track with revenue. Push for 2 more closures in Q3 to hit target.')
    `, [arjunIds[0], snehaIds[0], byEmail['manager1@company.com'], byEmail['manager2@company.com']]);

    // Audit log entries
    await client.query(`
      INSERT INTO audit_log (goal_id, user_id, action, detail) VALUES
        ($1, $6, 'Goal approved',           'Approved by Manager'),
        ($2, $6, 'Goal approved',           'Approved by Manager'),
        ($3, $6, 'Goal approved',           'Approved by Manager — Weightage adjusted to 20%'),
        ($4, $6, 'Goal approved',           'Approved by Manager'),
        ($5, $6, 'Goal approved',           'Approved by Manager'),
        ($1, $7, 'Q1 Achievement updated',  'actual_value: 65, score: 81.25%'),
        ($1, $7, 'Q2 Achievement updated',  'actual_value: 72, score: 90.00%')
    `, [...arjunIds.slice(0,5), byEmail['manager1@company.com'], byEmail['emp1@company.com']]);

    await client.query('COMMIT');
    console.log('✅ Seed complete.');
    console.log('\n📋 Demo credentials (password: password123):');
    console.log('  Admin:    admin@company.com');
    console.log('  Manager:  manager1@company.com  (Engineering)');
    console.log('  Manager:  manager2@company.com  (Sales)');
    console.log('  Employee: emp1@company.com  (Arjun Sharma)');
    console.log('  Employee: emp2@company.com  (Priya Mehta)');
    console.log('  Employee: emp3@company.com  (Sneha Patel)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
