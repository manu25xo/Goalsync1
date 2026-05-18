// Shared, reusable UI components

export function Avatar({ name = '?', size = 34 }) {
  const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'];
  const bg = colors[(name.charCodeAt(0) || 0) % colors.length];
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="avatar" style={{ background: bg, width: size, height: size, fontSize: size * 0.37 }}>
      {initials}
    </div>
  );
}

export function ProgressBar({ value, max = 100, color }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const c = color || (pct >= 80 ? 'var(--accent2)' : pct >= 50 ? 'var(--accent3)' : 'var(--danger)');
  return (
    <div className="progress-wrap">
      <div className="progress-bar" style={{ width: pct + '%', background: c }} />
    </div>
  );
}

export function Badge({ children, type = 'gray' }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner({ size = 18 }) {
  return <span className="spin" style={{ fontSize: size }}>⟳</span>;
}

export function Alert({ type = 'info', children }) {
  return <div className={`alert alert-${type}`}>{children}</div>;
}

export function StatusBadge({ status }) {
  const map = { approved: 'green', pending: 'yellow', rejected: 'red', draft: 'gray', rework: 'yellow' };
  return <Badge type={map[status] || 'gray'}>{status}</Badge>;
}

export function ProgressBadge({ status }) {
  const map = { 'On Track': 'green', 'Not Started': 'gray', 'Completed': 'blue', 'At Risk': 'red' };
  return <Badge type={map[status] || 'gray'}>{status}</Badge>;
}

export function scoreColor(score) {
  if (score === null || score === undefined) return 'var(--text3)';
  if (score >= 80) return 'var(--accent2)';
  if (score >= 50) return 'var(--accent3)';
  return 'var(--danger)';
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const THRUST_AREAS = [
  'Customer Satisfaction', 'Revenue Growth', 'Operational Excellence',
  'Innovation', 'People Development', 'Quality & Compliance',
];

export const UOM_OPTIONS = ['Numeric', 'Min', 'Max', '%', 'Timeline', 'Zero'];

export const UOM_HINTS = {
  'Numeric': 'Higher actual = better score',
  'Min':     'Higher actual = better score',
  'Max':     'Lower actual = better score (e.g. TAT, error rate)',
  '%':       'Percentage-based target',
  'Timeline':'Completion by deadline = 100%',
  'Zero':    'Zero incidents/errors = 100%',
};

export function computeScoreFE(uom, target, actual) {
  if (actual === null || actual === undefined || actual === '') return null;
  const t = parseFloat(target), a = parseFloat(actual);
  switch (uom) {
    case 'Numeric': case 'Min': case '%':
      return !t ? null : Math.min(100, Math.round((a / t) * 100));
    case 'Max':
      return !a ? null : Math.min(100, Math.round((t / a) * 100));
    case 'Zero':
      return a === 0 ? 100 : 0;
    case 'Timeline': {
      if (!target || !actual) return null;
      return new Date(actual) <= new Date(target) ? 100 : 0;
    }
    default: return null;
  }
}
