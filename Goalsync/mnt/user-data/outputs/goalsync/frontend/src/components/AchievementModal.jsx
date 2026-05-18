import { useState } from 'react';
import { Modal, Alert, ProgressBar, computeScoreFE, scoreColor } from './UI';
import { achievementsApi } from '../api';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function AchievementModal({ goal, onClose, onSaved }) {
  const existing = {};
  (goal.achievements || []).forEach(a => { existing[a.quarter] = a.actual_value ?? ''; });

  const [vals, setVals]       = useState({ Q1: existing.Q1 || '', Q2: existing.Q2 || '', Q3: existing.Q3 || '', Q4: existing.Q4 || '' });
  const [status, setStatus]   = useState(goal.progress_status || 'Not Started');
  const [saving, setSaving]   = useState(false);
  const [apiError, setApiError] = useState('');

  async function save() {
    setSaving(true); setApiError('');
    try {
      for (const q of QUARTERS) {
        if (vals[q] !== '' && vals[q] !== null) {
          await achievementsApi.upsert(goal.id, q, { actualValue: vals[q], progressStatus: status });
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to save achievement');
    } finally { setSaving(false); }
  }

  return (
    <Modal
      title={`📊 Log Achievement`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '⟳ Saving…' : 'Save Achievement'}
          </button>
        </>
      }
    >
      {apiError && <Alert type="danger">{apiError}</Alert>}

      <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{goal.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          Target: {goal.uom === 'Zero' ? '0 (Zero incidents)' : `${goal.target_value} ${goal.uom}`}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Progress Status</label>
        <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
          {['Not Started', 'On Track', 'At Risk', 'Completed'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid-2">
        {QUARTERS.map(q => {
          const score = computeScoreFE(goal.uom, goal.target_value, vals[q]);
          return (
            <div className="form-group" key={q}>
              <label className="form-label">{q} Actual</label>
              {goal.uom === 'Timeline'
                ? <input type="date" className="form-input" value={vals[q]}
                    onChange={e => setVals(p => ({ ...p, [q]: e.target.value }))} />
                : <input type="number" className="form-input" value={vals[q]}
                    onChange={e => setVals(p => ({ ...p, [q]: e.target.value }))}
                    placeholder="Enter actual" />
              }
              {score !== null && (
                <div style={{ marginTop: 6 }}>
                  <ProgressBar value={score} />
                  <div style={{ fontSize: 11, color: scoreColor(score), marginTop: 3 }}>
                    Score: {score}%
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
