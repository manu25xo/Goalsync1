import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from './UI';

const NAV = {
  employee: [
    { path: '/dashboard',  label: 'Dashboard',     icon: '🏠' },
    { path: '/goals',      label: 'My Goals',       icon: '🎯' },
    { path: '/schedule',   label: 'Check-in Schedule', icon: '📅' },
  ],
  manager: [
    { path: '/dashboard',  label: 'Dashboard',      icon: '🏠' },
    { path: '/team',       label: 'Team Goals',     icon: '👥' },
    { path: '/checkins',   label: 'Check-ins',      icon: '💬' },
    { path: '/schedule',   label: 'Schedule',       icon: '📅' },
  ],
  admin: [
    { path: '/dashboard',  label: 'Dashboard',      icon: '🏠' },
    { path: '/org-goals',  label: 'All Goals',      icon: '🎯' },
    { path: '/reports',    label: 'Reports',         icon: '📊' },
    { path: '/users',      label: 'Users',           icon: '👤' },
    { path: '/cycles',     label: 'Cycles',          icon: '🔄' },
    { path: '/audit',      label: 'Audit Trail',     icon: '🔍' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!user) return null;
  const items = NAV[user.role] || [];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">Goal<span>Sync</span></div>
        <div className="logo-sub">AtomQuest Portal</div>
      </div>

      <nav className="nav-section">
        <div className="nav-section-label">{user.role.toUpperCase()}</div>
        {items.map(item => (
          <div
            key={item.path}
            className={`nav-item${pathname.startsWith(item.path) ? ' active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </div>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div className="nav-section-label" style={{ marginTop: 16 }}>Account</div>
          <div className="nav-item" onClick={logout}>
            <span className="nav-icon">🚪</span>Sign Out
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <Avatar name={user.name} size={34} />
        <div className="user-meta">
          <div className="user-meta-name">{user.name}</div>
          <div className="user-meta-role">{user.role} · {user.department}</div>
        </div>
      </div>
    </aside>
  );
}
