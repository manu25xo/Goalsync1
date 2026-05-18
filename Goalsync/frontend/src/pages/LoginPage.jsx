import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const DEMO = [
    { label: 'Employee — Arjun', email: 'emp1@company.com' },
    { label: 'Employee — Priya', email: 'emp2@company.com' },
    { label: 'Employee — Sneha', email: 'emp3@company.com' },
    { label: 'Manager — Rahul',  email: 'manager1@company.com' },
    { label: 'Manager — Amit',   email: 'manager2@company.com' },
    { label: 'Admin — Divya',    email: 'admin@company.com' },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Both fields required'); return; }
    setLoading(true); setError('');
    try {
      const user = await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 800 }}>
            Goal<span style={{ color: 'var(--accent)' }}>Sync</span>
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            AtomQuest Performance Portal
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 20, marginBottom: 20 }}>Sign in</h2>

          {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@company.com" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="password123" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '11px' }}>
              {loading ? '⟳ Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Quick login */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
              Quick login (demo)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DEMO.map(d => (
                <button key={d.email} className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'flex-start', fontSize: 12 }}
                  onClick={() => { setForm({ email: d.email, password: 'password123' }); }}>
                  {d.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Password: password123</div>
          </div>
        </div>
      </div>
    </div>
  );
}
