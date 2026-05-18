import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { goalsApi, usersApi, checkinsApi } from '../api';
import GoalCard from '../components/GoalCard';
import AchievementModal from '../components/AchievementModal';
import { Modal, Alert, Spinner, Avatar, THRUST_AREAS, UOM_OPTIONS } from '../components/UI';

function PushSharedModal({ onClose, onSaved, currentUser }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', thrustArea: THRUST_AREAS[0], uom: 'Numeric', targetValue: '', recipients: [] });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { usersApi.team().then(setEmployees).catch(() => {}); }, []);

  function toggleRecipient(id) {
    setForm(p => ({ ...p, recipients: p.recipients.includes(id) ? p.recipients.filter(r => r !== id) : [...p.recipients, id] }));
  }

  async function save() {
    const e = {};
    if (!form.title.trim()) e.title = 'Title required';
    if (form.uom !== 'Zero' && !form.targetValue) e.targetValue = 'Target required';
    if (!form.recipients.length) e.recipients = 'Select at least one recipient';
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await goalsApi.pushShared({ ...form, targetValue: form.uom === 'Zero' ? '0' : form.targetValue, recipientIds: form.recipients });
      onSaved(); onClose();
    } catch (err) { setErrors({ general: err.response?.data?.error || 'Failed' }); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="🔗 Push Shared Goal" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '⟳' : 'Push Goal'}</button></>}>
      {errors.general && <Alert type="danger">{errors.general}</Alert>}
      <Alert type="info">Recipients can only adjust the weightage — title and target are read-only for them.</Alert>
      <div className="form-group">
        <label className="form-label">Goal Title *</label>
        <input className="form-input" value={form.title} onChange={e => f('title', e.target.value)} />
        {errors.title && <div className="form-error">{errors.title}</div>}
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-textarea" value={form.description} onChange={e => f('description', e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Thrust Area</label>
          <select className="form-select" value={form.thrustArea} onChange={e => f('thrustArea', e.target.value)}>
            {THRUST_AREAS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">UoM</label>
          <select className="form-select" value={form.uom} onChange={e => f('uom', e.target.value)}>
            {UOM_OPTIONS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      {form.uom !== 'Zero' && (
        <div className="form-group">
          <label className="form-label">Target *</label>
          <input className="form-input" type={form.uom === 'Timeline' ? 'date' : 'number'} value={form.targetValue} onChange={e => f('targetValue', e.target.value)} />
          {errors.targetValue && <div className="form-error">{errors.targetValue}</div>}
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Recipients *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {employees.map(emp => (
            <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={form.recipients.includes(emp.id)} onChange={() => toggleRecipient(emp.id)} />
              <Avatar name={emp.name} size={26} />
              {emp.name} <span style={{ color: 'var(--text3)', fontSize: 11 }}>— {emp.department}</span>
            </label>
          ))}
        </div>
        {errors.recipients && <div className="form-error">{errors.recipients}</div>}
      </div>
    </Modal>
  );
}

function CheckinModal({ goal, onClose, onSaved }) {
  const [quarter, setQuarter] = useState('Q2');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await checkinsApi.create({ goalId: goal.id, quarter, comment });
      onSaved(); onClose();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="💬 Manager Check-in Comment" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-success" onClick={save} disabled={saving}>{saving ? '⟳' : 'Save Comment'}</button></>}>
      <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 600 }}>{goal.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{goal.employee_name}</div>
      </div>
      <div className="form-group">
        <label className="form-label">Quarter</label>
        <select className="form-select" value={quarter} onChange={e => setQuarter(e.target.value)}>
          {['Q1','Q2','Q3','Q4'].map(q => <option key={q}>{q}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Comment *</label>
        <textarea className="form-textarea" style={{ minHeight: 110 }} value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Document check-in discussion, feedback, and next steps…" />
      </div>
    </Modal>
  );
}

export default function TeamGoalsPage() {
  const { user } = useAuth();
  const [goals,   setGoals]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('all');
  const [modal,   setModal]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setGoals(await goalsApi.list()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = goals.filter(g => tab === 'all' ? true : g.status === tab);
  const pending  = goals.filter(g => g.status === 'pending').length;

  // Group by employee
  const byEmployee = {};
  filtered.forEach(g => {
    if (!byEmployee[g.employee_id]) byEmployee[g.employee_id] = { name: g.employee_name, goals: [] };
    byEmployee[g.employee_id].goals.push(g);
  });

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Team Goals</h1>
            <p className="page-sub">Review, approve, and manage your team's goals</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'push-shared' })}>
            🔗 Push Shared Goal
          </button>
        </div>
      </div>

      {pending > 0 && <Alert type="warning">⚠️ {pending} goal(s) awaiting your approval</Alert>}

      <div className="card">
        <div className="tabs">
          {['all','pending','approved','draft','rework','rejected'].map(t => (
            <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'pending' && pending > 0 && <span style={{ marginLeft: 5, background: 'var(--accent3)', color: '#000', borderRadius: 10, fontSize: 10, padding: '1px 5px' }}>{pending}</span>}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="empty"><Spinner size={24} /></div>
        ) : Object.keys(byEmployee).length === 0 ? (
          <div className="empty"><div className="empty-icon">👥</div><div className="empty-text">No goals found</div></div>
        ) : (
          Object.entries(byEmployee).map(([uid, emp]) => (
            <div key={uid} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Avatar name={emp.name} size={30} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{emp.goals.length} goals · {emp.goals.reduce((s, g) => s + parseFloat(g.weightage || 0), 0)}% weight</div>
                </div>
              </div>
              {emp.goals.map(g => (
                <GoalCard key={g.id} goal={g} userRole={user.role} userId={user.id} onRefresh={load}
                  onEdit={() => {}} onAchievement={() => setModal({ type: 'achievement', goal: g })}
                  onCheckin={() => setModal({ type: 'checkin', goal: g })} />
              ))}
            </div>
          ))
        )}
      </div>

      {modal?.type === 'push-shared' && <PushSharedModal onClose={() => setModal(null)} onSaved={load} currentUser={user} />}
      {modal?.type === 'checkin'    && <CheckinModal goal={modal.goal} onClose={() => setModal(null)} onSaved={load} />}
      {modal?.type === 'achievement' && <AchievementModal goal={modal.goal} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}
