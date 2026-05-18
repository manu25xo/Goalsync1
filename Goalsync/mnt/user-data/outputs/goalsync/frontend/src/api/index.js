import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gs_token');
      localStorage.removeItem('gs_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:  (data)  => api.post('/auth/login', data).then(r => r.data),
  me:     ()      => api.get('/auth/me').then(r => r.data),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:   ()          => api.get('/users').then(r => r.data),
  team:   ()          => api.get('/users/team').then(r => r.data),
  create: (data)      => api.post('/users', data).then(r => r.data),
  update: (id, data)  => api.patch(`/users/${id}`, data).then(r => r.data),
};

// ── Goals ─────────────────────────────────────────────────────────────────────
export const goalsApi = {
  list:     (params)  => api.get('/goals', { params }).then(r => r.data),
  create:   (data)    => api.post('/goals', data).then(r => r.data),
  update:   (id, d)   => api.patch(`/goals/${id}`, d).then(r => r.data),
  submit:   (id)      => api.post(`/goals/${id}/submit`).then(r => r.data),
  approve:  (id, d)   => api.post(`/goals/${id}/approve`, d).then(r => r.data),
  reject:   (id, d)   => api.post(`/goals/${id}/reject`, d).then(r => r.data),
  unlock:   (id, d)   => api.post(`/goals/${id}/unlock`, d).then(r => r.data),
  delete:   (id)      => api.delete(`/goals/${id}`).then(r => r.data),
  pushShared: (data)  => api.post('/goals/shared', data).then(r => r.data),
};

// ── Achievements ──────────────────────────────────────────────────────────────
export const achievementsApi = {
  list:   (goalId)                  => api.get('/achievements', { params: { goalId } }).then(r => r.data),
  upsert: (goalId, quarter, data)   => api.put(`/achievements/${goalId}/${quarter}`, data).then(r => r.data),
};

// ── Check-ins ─────────────────────────────────────────────────────────────────
export const checkinsApi = {
  list:   (params)  => api.get('/checkins', { params }).then(r => r.data),
  create: (data)    => api.post('/checkins', data).then(r => r.data),
  delete: (id)      => api.delete(`/checkins/${id}`).then(r => r.data),
};

// ── Cycles ────────────────────────────────────────────────────────────────────
export const cyclesApi = {
  list:     ()      => api.get('/cycles').then(r => r.data),
  active:   ()      => api.get('/cycles/active').then(r => r.data),
  create:   (data)  => api.post('/cycles', data).then(r => r.data),
  activate: (id)    => api.patch(`/cycles/${id}/activate`).then(r => r.data),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  audit:       (params)  => api.get('/reports/audit', { params }).then(r => r.data),
  achievement: ()        => api.get('/reports/achievement').then(r => r.data),
  dashboard:   ()        => api.get('/reports/dashboard').then(r => r.data),
  downloadCsv: ()        => window.open('/api/reports/achievement/csv', '_blank'),
};
