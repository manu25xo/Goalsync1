import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';

import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GoalsPage     from './pages/GoalsPage';
import TeamGoalsPage from './pages/TeamGoalsPage';
import { ReportsPage, AuditPage } from './pages/ReportsPage';
import {
  SchedulePage,
  OrgGoalsPage,
  UsersPage,
  CyclesPage,
  CheckinsPage,
} from './pages/MiscPages';

// ── Protected route wrapper ───────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
            Goal<span style={{ color: 'var(--accent)' }}>Sync</span>
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return children;
}

// ── Layout wrapper (sidebar + main) ──────────────────────────────────────────
function AppLayout({ children }) {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

// ── Route definitions ─────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Redirect root based on auth */}
      <Route path="/" element={
        user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
      } />

      {/* ── Employee routes ── */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <AppLayout><DashboardPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/goals" element={
        <ProtectedRoute allowedRoles={['employee']}>
          <AppLayout><GoalsPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/schedule" element={
        <ProtectedRoute>
          <AppLayout><SchedulePage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* ── Manager routes ── */}
      <Route path="/team" element={
        <ProtectedRoute allowedRoles={['manager', 'admin']}>
          <AppLayout><TeamGoalsPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/checkins" element={
        <ProtectedRoute allowedRoles={['manager', 'admin']}>
          <AppLayout><CheckinsPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* ── Admin routes ── */}
      <Route path="/org-goals" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AppLayout><OrgGoalsPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute allowedRoles={['admin', 'manager']}>
          <AppLayout><ReportsPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AppLayout><UsersPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/cycles" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AppLayout><CyclesPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/audit" element={
        <ProtectedRoute allowedRoles={['admin', 'manager']}>
          <AppLayout><AuditPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
