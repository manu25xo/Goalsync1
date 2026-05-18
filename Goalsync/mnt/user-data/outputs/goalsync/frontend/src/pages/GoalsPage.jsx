import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { goalsApi, checkinsApi } from '../api';
import GoalCard from '../components/GoalCard';
import GoalFormModal from '../components/GoalFormModal';
import AchievementModal from '../components/AchievementModal';
import { Modal, Alert, Spinner } from '../components/UI';

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals,   setGoals]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('all');
  const [modal,   setModal]   = useState(null); // null | {type, goal?}

  const load = useCallback(async () => {
    setLoading(true);
    try { setGoals(await goalsApi.list()); }
    catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = goals.filter(g => tab === 'all' ? true : g.status === tab);
  const totalW   = goals.reduce((s, g) => s + parseFloat(g.weightage || 0), 0);
  const approved = goals.filter(g => g.status === 'approved').length;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">My Goals</h1>
            <p className="page-sub">FY 2025-26 · {goals.length} goals · {totalW}% total weight</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })}>
            + Add Goal
          </button>
        </div>
      </div>

      {/* Weight summary */}
      {goals.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Goals', val: goals.length, max: '/ 8' },
            { label: 'Approved', val: approved, col: 'var(--accent2)' },
            { label: 'Total Weight', val: totalW + '%', col: totalW === 100 ? 'var(--accent2)' : 'var(--danger)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', minWidth: 120 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-head)', color: s.col || 'var(--text)' }}>{s.val} <span style={{ fontSize: 13, color: 'var(--text3)' }}>{s.max}</span></div>
            </div>
          ))}
        </div>
      )}

      {totalW !== 100 && goals.length > 0 && (
        <Alert type="warning">⚠️ Total weightage is {totalW}%. Goals can only be submitted when total equals 100%.</Alert>
      )}

      <div className="card">
        <div className="tabs">
          {['all', 'draft', 'pending', 'approved', 'rework', 'rejected'].map(t => (
            <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'pending' && goals.filter(g => g.status === 'pending').length > 0 &&
                <span style={{ marginLeft: 5, background: 'var(--accent3)', color: '#000', borderRadius: 10, fontSize: 10, padding: '1px 5px' }}>
                  {goals.filter(g => g.status === 'pending').length}
                </span>}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="empty"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎯</div>
            <div className="empty-text">No goals here yet</div>
            {tab === 'all' && <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setModal({ type: 'add' })}>Add your first goal</button>}
          </div>
        ) : (
          filtered.map(g => (
            <GoalCard
              key={g.id}
              goal={g}
              userRole={user.role}
              userId={user.id}
              onRefresh={load}
              onEdit={() => setModal({ type: 'edit', goal: g })}
              onAchievement={() => setModal({ type: 'achievement', goal: g })}
              onCheckin={() => {}}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'add' && (
        <GoalFormModal
          mode="add"
          employeeId={user.id}
          existingGoals={goals}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {modal?.type === 'edit' && (
        <GoalFormModal
          mode="edit"
          goal={modal.goal}
          existingGoals={goals}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {modal?.type === 'achievement' && (
        <AchievementModal
          goal={modal.goal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
