const BASE = '/api';

function getToken() {
  return localStorage.getItem('l15_token');
}

async function req(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    ...opts,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── AUTH ──────────────────────────────────────────
export const auth = {
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  logout: () => req('POST', '/auth/logout'),
  me: () => req('GET', '/auth/me'),
  recovery: (email) => req('POST', '/auth/recovery', { email }),
};

// ── PROJECTS ──────────────────────────────────────
export const projects = {
  list: () => req('GET', '/projects'),
  create: (data) => req('POST', '/projects', data),
  update: (id, data) => req('PUT', `/projects/${id}`, data),
  delete: (id) => req('DELETE', `/projects/${id}`),
  finalize: (id, payload) => req('PUT', `/projects/${id}`, { action: 'finalize', ...payload }),
};

// ── CONTROLS ──────────────────────────────────────
export const controls = {
  updateCompliance: (id, compliance) => req('PUT', `/controls/${id}`, { compliance }),
};

// ── EVIDENCES ─────────────────────────────────────
export const evidences = {
  create: (data) => req('POST', '/evidences', data),
  update: (id, data) => req('PUT', `/evidences/${id}`, data),
  delete: (id) => req('DELETE', `/evidences/${id}`),
};

// ── USERS ─────────────────────────────────────────
export const users = {
  list: () => req('GET', '/users'),
  create: (data) => req('POST', '/users', data),
  update: (id, data) => req('PUT', `/users/${id}`, data),
  delete: (id) => req('DELETE', `/users/${id}`),
};

// ── LOGS ──────────────────────────────────────────
export const logs = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req('GET', `/logs${qs ? '?' + qs : ''}`);
  },
  add: (data) => req('POST', '/logs', data),
};

// ── ARCHIVE ───────────────────────────────────────
export const archive = {
  list: () => req('GET', '/archive'),
};
