import { useState } from 'react';
import { StatusBadge, ProgressBadge, ProgressBar, scoreColor, computeScoreFE, fmtDate } from './UI';
import { goalsApi } from '../api';

export default function GoalCard({ goal, userRole, userId, onRefresh, onEdit, onAchievement, onCheckin }) {
  const [acting, setActing] = useState('');

  const isOwner   = goal.employee_id === userId;
  const isManager = userRole === 'manager';
  const isAdmin   = userRole === 'admin';

  async function act(fn, label) {
    setActing(label);
    try { await fn(); await onRefresh(); }
    catch (e) { alert(e.response?.data?.error || 'Action failed'); }
    finally { setActing(''); }
  }

  // Achievements map
  const achMap = {};
  (goal.achievements || []).forEach(a => { achMap[a.quarter] = a; });

  return (
    <div className="goal-row">
      {/* Header */}
      <div className="goal-row-header">
        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <div className="goal-title-text">{goal.title}</div>
          {goal.description && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{goal.description}</div>
          )}
        </div>
        <div className="goal-badges">
          <StatusBadge status={goal.status} />
          {goal.status === 'approved' && <ProgressBadge status={goal.progress_status} />}
          {goal.is_shared && <span className="badge badge-purple">🔗 Shared</span>}
        </div>
      </div>

      {/* Meta chips */}
      <div className="goal-meta">
        <span className="chip">🎯 {goal.thrust_area}</span>
        <span className="chip">UoM: {goal.uom}</span>
        <span className="chip">Target: {goal.uom === 'Zero' ? '0' : goal.target_value}</span>
        <span className="chip">Weight: {goal.weightage}%</span>
        {goal.locked_at && <span className="chip">🔒 Locked {fmtDate(goal.locked_at)}</span>}
        {goal.shared_from_name && <span className="chip">Pushed by {goal.shared_from_name}</span>}
        {(isManager || isAdmin) && goal.employee_name && (
          <span className="chip">👤 {goal.employee_name}</span>
        )}
      </div>

      {/* Quarter progress — only for approved goals */}
      {goal.status === 'approved' && (
        <div className="goal-progress" style={{ marginTop: 12 }}>
          {['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
            const a = achMap[q];
            const score = a ? computeScoreFE(goal.uom, goal.target_value, a.actual_value) : null;
            return (
              <div key={q}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{q}</div>
                {score !== null ? (
                  <>
                    <ProgressBar value={score} />
                    <div style={{ fontSize: 11, color: scoreColor(score), marginTop: 3 }}>
                      {score}% · {a.actual_value}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>—</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Checkin comments */}
      {(goal.checkin_comments || []).length > 0 && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, borderLeft: '3px solid var(--accent)' }}>
          {goal.checkin_comments.slice(-1).map(c => (
            <div key={c.id}>
              <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 2 }}>Manager comment ({c.quarter})</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{c.comment}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="goal-actions">
        {/* Employee actions */}
        {isOwner && (goal.status === 'draft' || goal.status === 'rework') && (
          <>
            <button className="btn btn-ghost btn-xs" onClick={onEdit}>✏️ Edit</button>
            <button className="btn btn-primary btn-xs" disabled={!!acting}
              onClick={() => act(() => goalsApi.submit(goal.id), 'submit')}>
              {acting === 'submit' ? '⟳' : '🚀'} Submit
            </button>
          </>
        )}
        {isOwner && goal.status === 'draft' && !goal.is_shared && (
          <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger)' }} disabled={!!acting}
            onClick={() => { if (confirm('Delete this goal?')) act(() => goalsApi.delete(goal.id), 'delete'); }}>
            🗑 Delete
          </button>
        )}
        {isOwner && goal.status === 'approved' && (
          <button className="btn btn-ghost btn-xs" onClick={onAchievement}>📊 Log Achievement</button>
        )}

        {/* Manager actions */}
        {(isManager || isAdmin) && goal.status === 'pending' && (
          <>
            <button className="btn btn-success btn-xs" disabled={!!acting}
              onClick={() => act(() => goalsApi.approve(goal.id, {}), 'approve')}>
              {acting === 'approve' ? '⟳' : '✓'} Approve
            </button>
            <button className="btn btn-ghost btn-xs" disabled={!!acting}
              onClick={() => act(() => goalsApi.reject(goal.id, { returnForRework: true }), 'rework')}>
              ↩ Return
            </button>
            <button className="btn btn-danger btn-xs" disabled={!!acting}
              onClick={() => act(() => goalsApi.reject(goal.id, { returnForRework: false }), 'reject')}>
              ✗ Reject
            </button>
          </>
        )}
        {(isManager || isAdmin) && goal.status === 'approved' && (
          <button className="btn btn-ghost btn-xs" onClick={onCheckin}>💬 Add Check-in</button>
        )}

        {/* Admin unlock */}
        {isAdmin && goal.status === 'approved' && (
          <button className="btn btn-ghost btn-xs" disabled={!!acting}
            onClick={() => act(() => goalsApi.unlock(goal.id, { reason: 'Admin exception' }), 'unlock')}>
            🔓 Unlock
          </button>
        )}
      </div>
    </div>
  );
}
