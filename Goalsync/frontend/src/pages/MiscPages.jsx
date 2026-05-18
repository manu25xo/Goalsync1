import { useEffect, useState, useCallback } from 'react';
import { goalsApi, cyclesApi, usersApi, checkinsApi } from '../api';
import GoalCard from '../components/GoalCard';
import AchievementModal from '../components/AchievementModal';
import { Spinner, Avatar, Alert, Modal, fmtDate, fmtDateTime } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';

// ── Check-in Schedule ─────────────────────────────────────────────────────────
export function SchedulePage() {
  const SCHEDULE = [
    { period: 'Phase 1 — Goal Setting', opens: '1 May 2025', close: '31 May 2025', action: 'Goal creation, submission & manager approval', status: 'done' },
    { period: 'Q1 Check-in',   opens: 'July 2025',    close: '31 Jul 2025',  action: 'Log Q1 actuals & planned vs actual discussion', status: 'done' },
    { period: 'Q2 Check-in',   opens: 'October 2025', close: '31 Oct 2025',  action: 'Log Q2 actuals & mid-year review', status: 'active' },
    { period: 'Q3 Check-in',   opens: 'January 2026', close: '31 Jan 2026',  action: 'Log Q3 actuals & course correction', status: 'upcoming' },
    { period: 'Q4 / Annual',   opens: 'April 2026',   close: '30 Apr 2026',  action: 'Final achievement capture & annual rating', status: 'upcoming' },
  ];
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Check-in Schedule</h1>
        <p className="page-sub">FY 2025-26 quarterly windows</p>
      </div>
      <div className="card">
        {SCHEDULE.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 20, padding: '16px 0', borderBottom: i < SCHEDULE.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                background: s.status === 'active' ? 'var(--accent2)' : s.status === 'done' ? 'var(--text3)' : 'var(--border)',
                boxShadow: s.status === 'active' ? '0 0 10px var(--accent2)' : 'none' }} />
              {i < SCHEDULE.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{s.period}</span>
                <span className={`badge badge-${s.status === 'active' ? 'green' : s.status === 'done' ? 'gray' : 'blue'}`}>
                  {s.status === 'active' ? '● Active' : s.status === 'done' ? 'Completed' : 'Upcoming'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.opens} → {s.close}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>{s.action}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Org Goals (Admin) ─────────────────────────────────────────────────────────
export function OrgGoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [filter, setFilter]   = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try { setGoals(await goalsApi.list()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = goals.filter(g => filter === 'all' ? true : g.status === filter);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">All Goals</h1>
        <p className="page-sub">{goals.length} goals across the org</p>
      </div>
      <div className="card">
        <div className="tabs">
          {['all','pending','approved','draft','rework','rejected'].map(t => (
            <div key={t} className={`tab${filter === t ? ' active' : ''}`} onClick={() => setFilter(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>
        {loading ? <div className="empty"><Spinner size={24} /></div>
          : filtered.length === 0 ? <div className="empty"><div className="empty-text">No goals</div></div>
          : filtered.map(g => (
            <GoalCard key={g.id} goal={g} userRole={user.role} userId={user.id} onRefresh={load}
              onEdit={() => {}} onAchievement={() => setModal({ type: 'achievement', goal: g })} onCheckin={() => {}} />
          ))}
      </div>
      {modal?.type === 'achievement' && <AchievementModal goal={modal.goal} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}

// ── Users (Admin) ─────────────────────────────────────────────────────────────
export function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState({ name: '', email: '', password: 'password123', role: 'employee', department: '', managerId: '' });
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await usersApi.list()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createUser() {
    setSaving(true); setErr('');
    try { await usersApi.create({ ...form, managerId: form.managerId || undefined }); setModal(null); load(); }
    catch (e) { setErr(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  }

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><h1 className="page-title">Users</h1><p className="page-sub">{users.length} users</p></div>
          <button className="btn btn-primary" onClick={() => { setForm({ name: '', email: '', password: 'password123', role: 'employee', department: '', managerId: '' }); setModal('add'); }}>+ Add User</button>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Manager</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6}><Spinner /></td></tr>
                : users.map(u => (
                <tr key={u.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={u.name} size={28} />{u.name}</div></td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{u.email}</td>
                  <td><span className={`badge badge-${u.role === 'admin' ? 'red' : u.role === 'manager' ? 'blue' : 'gray'}`}>{u.role}</span></td>
                  <td style={{ fontSize: 12 }}>{u.department || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{u.manager_name || '—'}</td>
                  <td><span className={`badge badge-${u.is_active ? 'green' : 'red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal === 'add' && (
        <Modal title="Add User" onClose={() => setModal(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={createUser} disabled={saving}>{saving ? '⟳' : 'Create User'}</button></>}>
          {err && <Alert type="danger">{err}</Alert>}
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={form.email} onChange={e => f('email', e.target.value)} /></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Password</label><input className="form-input" value={form.password} onChange={e => f('password', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => f('role', e.target.value)}>
                {['employee','manager','admin'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={form.department} onChange={e => f('department', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Manager</label>
              <select className="form-select" value={form.managerId} onChange={e => f('managerId', e.target.value)}>
                <option value="">— None —</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Cycles (Admin) ────────────────────────────────────────────────────────────
export function CyclesPage() {
  const [cycles, setCycles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState({ name: '', fiscalYear: '2025-26', phase: 'goal_setting', windowOpen: '', windowClose: '' });
  const [saving, setSaving]   = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try { setCycles(await cyclesApi.list()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setSaving(true);
    try { await cyclesApi.create(form); setModal(false); load(); }
    catch (e) { alert(e.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><h1 className="page-title">Cycles</h1><p className="page-sub">Manage check-in windows</p></div>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Cycle</button>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>FY</th><th>Phase</th><th>Window</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6}><Spinner /></td></tr>
                : cycles.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td>{c.fiscal_year}</td>
                  <td><span className="badge badge-blue">{c.phase}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{fmtDate(c.window_open)} → {fmtDate(c.window_close)}</td>
                  <td><span className={`badge badge-${c.is_active ? 'green' : 'gray'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>{!c.is_active && <button className="btn btn-success btn-xs" onClick={async () => { await cyclesApi.activate(c.id); load(); }}>Activate</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <Modal title="New Cycle" onClose={() => setModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? '⟳' : 'Create'}</button></>}>
          <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Q3 Check-in 2025" /></div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Fiscal Year</label><input className="form-input" value={form.fiscalYear} onChange={e => f('fiscalYear', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Phase</label>
              <select className="form-select" value={form.phase} onChange={e => f('phase', e.target.value)}>
                {['goal_setting','q1','q2','q3','q4'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Window Open</label><input type="date" className="form-input" value={form.windowOpen} onChange={e => f('windowOpen', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Window Close</label><input type="date" className="form-input" value={form.windowClose} onChange={e => f('windowClose', e.target.value)} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Check-ins (Manager) ───────────────────────────────────────────────────────
export function CheckinsPage() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    checkinsApi.list().then(setComments).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Check-in Comments</h1>
        <p className="page-sub">All check-in comments you've added</p>
      </div>
      <div className="card">
        {loading ? <div className="empty"><Spinner size={24} /></div>
          : comments.length === 0 ? <div className="empty"><div className="empty-icon">💬</div><div className="empty-text">No check-in comments yet</div></div>
          : comments.map(c => (
          <div key={c.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.goal_title}</div>
              <span className="badge badge-blue">{c.quarter}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Employee: {c.employee_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{c.comment}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{fmtDateTime(c.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
