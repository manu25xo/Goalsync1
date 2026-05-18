import { useEffect, useState } from 'react';
import { reportsApi } from '../api';
import { scoreColor, computeScoreFE, fmtDateTime, Avatar, Spinner } from '../components/UI';

export function ReportsPage() {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi.achievement().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const byEmployee = {};
  data.forEach(row => {
    if (!byEmployee[row.employee_id]) {
      byEmployee[row.employee_id] = {
        name: row.employee_name, dept: row.department, manager: row.manager_name, goals: []
      };
    }
    byEmployee[row.employee_id].goals.push(row);
  });

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Achievement Report</h1>
            <p className="page-sub">Org-wide goal performance</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reportsApi.downloadCsv}>⬇ Export CSV</button>
        </div>
      </div>

      {loading ? <div className="empty"><Spinner size={24} /></div> : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th><th>Goal</th><th>Thrust Area</th>
                  <th>Target</th><th>Weight</th>
                  <th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const scores = {
                    Q1: row.q1_actual !== null ? computeScoreFE(row.uom, row.target_value, row.q1_actual) : null,
                    Q2: row.q2_actual !== null ? computeScoreFE(row.uom, row.target_value, row.q2_actual) : null,
                    Q3: row.q3_actual !== null ? computeScoreFE(row.uom, row.target_value, row.q3_actual) : null,
                    Q4: row.q4_actual !== null ? computeScoreFE(row.uom, row.target_value, row.q4_actual) : null,
                  };
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={row.employee_name} size={24} />
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{row.employee_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{row.department}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{row.title}</div>
                      </td>
                      <td><span style={{ fontSize: 12, color: 'var(--text3)' }}>{row.thrust_area}</span></td>
                      <td style={{ fontSize: 12 }}>{row.uom === 'Zero' ? '0' : row.target_value} {row.uom}</td>
                      <td>{row.weightage}%</td>
                      {['Q1','Q2','Q3','Q4'].map(q => {
                        const s = scores[q];
                        return (
                          <td key={q}>
                            {s !== null ? <span style={{ color: scoreColor(s), fontWeight: 600, fontSize: 13 }}>{s}%</span> : <span style={{ color: 'var(--text3)' }}>—</span>}
                          </td>
                        );
                      })}
                      <td>
                        <span className={`badge badge-${row.progress_status === 'On Track' ? 'green' : row.progress_status === 'At Risk' ? 'red' : 'gray'}`}>
                          {row.progress_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditPage() {
  const [log, setLog]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi.audit({ limit: 100 }).then(setLog).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audit Trail</h1>
        <p className="page-sub">Full history of all goal changes</p>
      </div>
      <div className="card">
        {loading ? <div className="empty"><Spinner size={24} /></div> : log.length === 0 ? (
          <div className="empty"><div className="empty-icon">🔍</div><div className="empty-text">No audit entries</div></div>
        ) : log.map(entry => (
          <div key={entry.id} className="audit-entry">
            <div className="audit-dot" />
            <div style={{ flex: 1 }}>
              <div className="audit-text">
                <strong>{entry.actor_name || 'System'}</strong>
                <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 6 }}>({entry.actor_role})</span>
                {' — '}{entry.action}
                {entry.goal_title && <span style={{ color: 'var(--text3)' }}> on "{entry.goal_title.substring(0, 50)}{entry.goal_title.length > 50 ? '…' : ''}"</span>}
                {entry.employee_name && <span style={{ color: 'var(--text3)' }}> ({entry.employee_name})</span>}
              </div>
              {entry.detail && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{entry.detail}</div>}
              <div className="audit-time">{fmtDateTime(entry.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
