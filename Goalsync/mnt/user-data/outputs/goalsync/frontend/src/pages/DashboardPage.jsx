import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { goalsApi, reportsApi } from '../api';
import { ProgressBar, scoreColor, fmtDateTime, Avatar, computeScoreFE } from '../components/UI';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text)' }}>{value}</div>
      {sub && <div className="stat-hint">{sub}</div>}
    </div>
  );
}

// ── Employee dashboard ────────────────────────────────────────────────────────
function EmployeeDashboard({ user }) {
  const [goals, setGoals] = useState([]);
  useEffect(() => { goalsApi.list().then(setGoals).catch(() => {}); }, []);

  const approved = goals.filter(g => g.status === 'approved').length;
  const totalW   = goals.reduce((s, g) => s + parseFloat(g.weightage || 0), 0);
  const q2Scores = goals.flatMap(g => (g.achievements || []).filter(a => a.quarter === 'Q2').map(a => computeScoreFE(g.uom, g.target_value, a.actual_value))).filter(s => s !== null);
  const avgQ2    = q2Scores.length ? Math.round(q2Scores.reduce((a, b) => a + b, 0) / q2Scores.length) : null;

  return (
    <>
      <div className="cycle-banner">
        <div className="pulse" />
        <div>
          <span style={{ fontWeight: 600, color: 'var(--accent2)' }}>Q2 Check-in Window Active</span>
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 10 }}>Window closes October 31, 2025</span>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard label="Total Goals" value={goals.length} sub="Max 8 allowed" />
        <StatCard label="Approved" value={approved} color="var(--accent2)" sub="Locked & active" />
        <StatCard label="Total Weightage" value={totalW + '%'} color={totalW === 100 ? 'var(--accent2)' : 'var(--danger)'} sub={totalW === 100 ? '✓ Valid' : 'Must equal 100%'} />
        <StatCard label="Avg Q2 Score" value={avgQ2 !== null ? avgQ2 + '%' : '—'} color={avgQ2 !== null ? scoreColor(avgQ2) : 'var(--text3)'} sub="Based on actuals" />
      </div>
      {/* Recent goals */}
      <div className="card">
        <div className="card-title">Goal Summary</div>
        {goals.length === 0 ? (
          <div className="empty"><div className="empty-icon">🎯</div><div className="empty-text">No goals yet — go to My Goals to add some</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Goal</th><th>Thrust Area</th><th>Weight</th><th>Status</th><th>Q2 Score</th></tr></thead>
              <tbody>
                {goals.map(g => {
                  const a = (g.achievements || []).find(a => a.quarter === 'Q2');
                  const score = a ? computeScoreFE(g.uom, g.target_value, a.actual_value) : null;
                  return (
                    <tr key={g.id}>
                      <td><div style={{ fontWeight: 500 }}>{g.title}</div></td>
                      <td><span style={{ fontSize: 12, color: 'var(--text3)' }}>{g.thrust_area}</span></td>
                      <td>{g.weightage}%</td>
                      <td><span className={`badge badge-${g.status === 'approved' ? 'green' : g.status === 'pending' ? 'yellow' : 'gray'}`}>{g.status}</span></td>
                      <td>{score !== null ? <span style={{ color: scoreColor(score), fontWeight: 600 }}>{score}%</span> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── Manager / Admin dashboard ─────────────────────────────────────────────────
function ManagerDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [goals, setGoals] = useState([]);
  useEffect(() => {
    reportsApi.dashboard().then(setStats).catch(() => {});
    goalsApi.list().then(setGoals).catch(() => {});
  }, []);

  const pending = goals.filter(g => g.status === 'pending');
  const atRisk  = goals.filter(g => g.progress_status === 'At Risk');

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Employees" value={stats?.total_employees ?? '…'} />
        <StatCard label="Pending Approval" value={stats?.pending_goals ?? '…'} color={parseInt(stats?.pending_goals) > 0 ? 'var(--accent3)' : undefined} sub={parseInt(stats?.pending_goals) > 0 ? 'Action needed' : 'All clear'} />
        <StatCard label="Goals Approved" value={stats?.approved_goals ?? '…'} color="var(--accent2)" />
        <StatCard label="Avg Q2 Score" value={stats?.avg_q2_score ? Math.round(stats.avg_q2_score) + '%' : '—'} color={stats?.avg_q2_score ? scoreColor(Math.round(stats.avg_q2_score)) : undefined} />
      </div>
      {pending.length > 0 && (
        <div className="alert alert-warning">⚠️ {pending.length} goal(s) awaiting your approval — check Team Goals</div>
      )}
      {atRisk.length > 0 && (
        <div className="alert alert-danger">🔴 {atRisk.length} goal(s) marked At Risk</div>
      )}
      <div className="card">
        <div className="card-title">Team Goals Overview</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Goal</th><th>Status</th><th>Q2 Score</th><th>Progress</th></tr></thead>
            <tbody>
              {goals.slice(0, 15).map(g => {
                const a = (g.achievements || []).find(a => a.quarter === 'Q2');
                const score = a ? computeScoreFE(g.uom, g.target_value, a.actual_value) : null;
                return (
                  <tr key={g.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{g.employee_name}</td>
                    <td style={{ maxWidth: 220 }}><div style={{ fontWeight: 500, fontSize: 13 }}>{g.title}</div></td>
                    <td><span className={`badge badge-${g.status === 'approved' ? 'green' : g.status === 'pending' ? 'yellow' : 'gray'}`}>{g.status}</span></td>
                    <td>{score !== null ? <span style={{ color: scoreColor(score), fontWeight: 600 }}>{score}%</span> : '—'}</td>
                    <td style={{ minWidth: 100 }}>
                      <span className={`badge badge-${g.progress_status === 'On Track' ? 'green' : g.progress_status === 'At Risk' ? 'red' : 'gray'}`}>
                        {g.progress_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {user.role === 'employee' ? `👋 Welcome, ${user.name.split(' ')[0]}` : user.role === 'admin' ? '⚙️ Admin Dashboard' : '👥 Manager Dashboard'}
        </h1>
        <p className="page-sub">Goal Setting & Tracking Portal — FY 2025-26</p>
      </div>
      {user.role === 'employee' ? <EmployeeDashboard user={user} /> : <ManagerDashboard user={user} />}
    </div>
  );
}
