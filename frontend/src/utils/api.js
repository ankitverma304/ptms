import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ── Attach access token to every request ──────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto-refresh on 401 ───────────────────────────────────────
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Typed API helpers ─────────────────────────────────────────
export const authAPI = {
  login:    (data)  => api.post('/auth/login', data),
  register: (data)  => api.post('/auth/register', data),
  logout:   ()      => api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }),
  me:       ()      => api.get('/auth/me'),
};

export const projectAPI = {
  list:          (params)     => api.get('/projects', { params }),
  get:           (id)         => api.get(`/projects/${id}`),
  create:        (data)       => api.post('/projects', data),
  update:        (id, data)   => api.put(`/projects/${id}`, data),
  delete:        (id)         => api.delete(`/projects/${id}`),
  dashboard:     (id)         => api.get(`/projects/${id}/dashboard`),
  addMember:     (id, data)   => api.post(`/projects/${id}/members`, data),
  removeMember:  (id, userId) => api.delete(`/projects/${id}/members/${userId}`),
};

export const ticketAPI = {
  listAll:       (params)            => api.get('/tickets', { params }),
  list:          (projectId, params) => api.get(`/projects/${projectId}/tickets`, { params }),
  get:           (id)                => api.get(`/tickets/${id}`),
  create:        (data)              => api.post('/tickets', data),
  update:        (id, data)          => api.patch(`/tickets/${id}`, data),
  changeStatus:  (id, status)        => api.patch(`/tickets/${id}/status`, { status }),
  delete:        (id)                => api.delete(`/tickets/${id}`),
  logBug:        (id, data)          => api.post(`/tickets/${id}/log-bug`, data),
  adjustPoints:  (id, data)          => api.post(`/tickets/${id}/adjust-points`, data),
};

export const timeLogAPI = {
  log:           (data)          => api.post('/time-logs', data),
  listForTicket: (ticketId)      => api.get(`/tickets/${ticketId}/time-logs`),
  userTimeline:  (userId, params) => api.get(`/users/${userId}/timeline`, { params }),
  update:        (id, data)      => api.put(`/time-logs/${id}`, data),
  delete:        (id)            => api.delete(`/time-logs/${id}`),
};

export const commentAPI = {
  list:   (ticketId)      => api.get(`/tickets/${ticketId}/comments`),
  create: (ticketId, data) => api.post(`/tickets/${ticketId}/comments`, data),
  update: (id, data)      => api.put(`/comments/${id}`, data),
  delete: (id)            => api.delete(`/comments/${id}`),
};

export const reportAPI = {
  userPerformance: (params) => api.get('/reports/user-performance', { params }),
  bugAnalytics:    (params) => api.get('/reports/bug-analytics', { params }),
  projectProgress: (params) => api.get('/reports/project-progress', { params }),
  timeTracking:    (params) => api.get('/reports/time-tracking', { params }),
  leaderboard:     (params) => api.get('/reports/leaderboard', { params }),
  overdue:         (params) => api.get('/reports/overdue', { params }),
  pointsJourney:   (params) => api.get('/reports/points-journey', { params }),
};

export const roleAPI = {
  list:       ()          => api.get('/roles'),
  create:     (data)      => api.post('/roles', data),
  update:     (id, data)  => api.put(`/roles/${id}`, data),
  delete:     (id)        => api.delete(`/roles/${id}`),
  assign:     (data)      => api.post('/roles/assign', data),
  setModules: (id, mods)  => api.put(`/roles/${id}/modules`, { modules: mods }),
};

export const userAPI = {
  list:            (params) => api.get('/users', { params }),
  get:             (id)     => api.get(`/users/${id}`),
  create:          (data)   => api.post('/users', data),
  update:          (id, d)  => api.put(`/users/${id}`, d),
  notifications:   ()       => api.get('/users/me/notifications'),
  markRead:        (ids)    => api.post('/users/me/notifications/read', { ids }),
};

export default api;
