import { useState, useEffect } from 'react';
import { Modal, Alert, THRUST_AREAS, UOM_OPTIONS, UOM_HINTS, computeScoreFE } from './UI';
import { goalsApi } from '../api';

export default function GoalFormModal({ mode = 'add', goal, employeeId, onClose, onSaved, existingGoals = [] }) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState(() => isEdit ? {
    title:       goal.title,
    description: goal.description || '',
    thrustArea:  goal.thrust_area,
    uom:         goal.uom,
    targetValue: goal.target_value || '',
    weightage:   goal.weightage,
  } : {
    title: '', description: '', thrustArea: THRUST_AREAS[0],
    uom: 'Numeric', targetValue: '', weightage: '',
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Running total
  const otherWeight = existingGoals
    .filter(g => g.id !== goal?.id)
    .reduce((s, g) => s + parseFloat(g.weightage || 0), 0);
  const newTotal = otherWeight + (parseFloat(form.weightage) || 0);

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (form.uom !== 'Zero' && !form.targetValue) e.targetValue = 'Target is required';
    if (!form.weightage) e.weightage = 'Weightage is required';
    else if (parseFloat(form.weightage) < 10) e.weightage = 'Minimum weightage is 10%';
    else if (newTotal > 100) e.weightage = `Total would be ${newTotal}% (max 100%)`;
    if (!isEdit && existingGoals.length >= 8) e.general = 'Maximum 8 goals per employee';
    return e;
  }

  async function save() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        thrustArea: form.thrustArea,
        uom: form.uom,
        targetValue: form.uom === 'Zero' ? '0' : String(form.targetValue),
        weightage: parseFloat(form.weightage),
        employeeId,
      };
      const saved = isEdit
        ? await goalsApi.update(goal.id, payload)
        : await goalsApi.create(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.error || 'Failed to save goal');
    } finally { setSaving(false); }
  }

  return (
    <Modal
      title={isEdit ? '✏️ Edit Goal' : '➕ Add New Goal'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '⟳ Saving…' : isEdit ? 'Save Changes' : 'Add Goal'}
          </button>
        </>
      }
    >
      {apiError && <Alert type="danger">{apiError}</Alert>}
      {errors.general && <Alert type="danger">{errors.general}</Alert>}

      {/* Weight indicator */}
      <div className="weight-bar">
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>Weightage Total:</span>
        <span className={`weight-value ${newTotal === 100 ? 'c-ok' : newTotal > 100 ? 'c-danger' : 'c-warn'}`}>
          {newTotal}%
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>(must equal 100%)</span>
      </div>

      <div className="form-group">
        <label className="form-label">Goal Title *</label>
        <input className="form-input" value={form.title} onChange={e => f('title', e.target.value)}
          placeholder="e.g. Increase code coverage to 80%" />
        {errors.title && <div className="form-error">{errors.title}</div>}
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="form-textarea" value={form.description}
          onChange={e => f('description', e.target.value)}
          placeholder="Brief context or success criteria…" />
      </div>

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Thrust Area *</label>
          <select className="form-select" value={form.thrustArea} onChange={e => f('thrustArea', e.target.value)}>
            {THRUST_AREAS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Unit of Measurement *</label>
          <select className="form-select" value={form.uom} onChange={e => f('uom', e.target.value)}>
            {UOM_OPTIONS.map(u => <option key={u}>{u}</option>)}
          </select>
          <div className="form-hint">{UOM_HINTS[form.uom]}</div>
        </div>
      </div>

      <div className="grid-2">
        {form.uom !== 'Zero' && (
          <div className="form-group">
            <label className="form-label">{form.uom === 'Timeline' ? 'Deadline *' : 'Target *'}</label>
            <input className="form-input"
              type={form.uom === 'Timeline' ? 'date' : 'number'}
              value={form.targetValue}
              onChange={e => f('targetValue', e.target.value)} />
            {errors.targetValue && <div className="form-error">{errors.targetValue}</div>}
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Weightage (%) *</label>
          <input className="form-input" type="number" min={10} max={100}
            value={form.weightage} onChange={e => f('weightage', e.target.value)}
            placeholder="Min 10%" />
          {errors.weightage && <div className="form-error">{errors.weightage}</div>}
        </div>
      </div>
    </Modal>
  );
}
