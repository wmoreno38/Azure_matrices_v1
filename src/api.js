// ═══════════════════════════════════════════════════
// API Client for Línea 1.5 V3
// All calls go to /api/* (Vercel serverless functions)
// ═══════════════════════════════════════════════════

let _token = localStorage.getItem('l15-token') || null;

function setToken(t) {
  _token = t;
  if (t) localStorage.setItem('l15-token', t);
  else localStorage.removeItem('l15-token');
}

function getToken() { return _token; }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = 'Bearer ' + _token;

  const res = await fetch('/api' + path, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (res.status === 401) {
    setToken(null);
    window.location.reload();
    return null;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// ═══ AUTH ═══
export async function login(email, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (data.token) setToken(data.token);
  return data;
}

export async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch(e) { /* ignore */ }
  setToken(null);
}

export async function getSession() {
  if (!_token) return null;
  try {
    return await api('/auth/me');
  } catch(e) {
    setToken(null);
    return null;
  }
}

export async function recoverPassword(email) {
  return api('/auth/recovery', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

// ═══ PROJECTS ═══
export async function loadProjects() {
  return api('/projects');
}

export async function createProject(name, publishDate, responsible, controls) {
  return api('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, publishDate, responsible, controls })
  });
}

export async function deleteProject(id) {
  return api('/projects/' + id, { method: 'DELETE' });
}

export async function finalizeProject(id, finalizedBy, finalizedByRole, stats) {
  return api('/projects/' + id, {
    method: 'PUT',
    body: JSON.stringify({ action: 'finalize', finalizedBy, finalizedByRole, stats })
  });
}

// ═══ CONTROLS ═══
export async function updateCompliance(controlId, compliance) {
  return api('/controls/' + controlId, {
    method: 'PUT',
    body: JSON.stringify({ compliance })
  });
}

// ═══ EVIDENCES ═══
export async function addEvidence(projectId, controlId, evidence) {
  return api('/evidences', {
    method: 'POST',
    body: JSON.stringify({
      projectId, controlId,
      type: evidence.type,
      description: evidence.description,
      date: evidence.date,
      notes: evidence.notes,
      reviewer: evidence.reviewer,
      files: evidence.files
    })
  });
}

export async function updateEvidenceStatus(id, status, reviewer) {
  return api('/evidences/' + id, {
    method: 'PUT',
    body: JSON.stringify({ status, reviewer })
  });
}

export async function updateEvidence(id, updates) {
  return api('/evidences/' + id, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

export async function deleteEvidence(id) {
  return api('/evidences/' + id, { method: 'DELETE' });
}

// ═══ USERS ═══
export async function loadUsers() {
  return api('/users');
}

export async function createUser(email, password, username, name, role) {
  return api('/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, username, name, role })
  });
}

export async function toggleUser(id, active) {
  return api('/users/' + id, {
    method: 'PUT',
    body: JSON.stringify({ action: 'toggle', active })
  });
}

export async function deleteUser(id) {
  return api('/users/' + id, { method: 'DELETE' });
}

export async function updateUser(id, updates) {
  return api('/users/' + id, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

export async function updateUserPerms(id, projectPerms) {
  return api('/users/' + id, {
    method: 'PUT',
    body: JSON.stringify({ action: 'update_perms', project_perms: projectPerms })
  });
}

// ═══ LOGS ═══
export async function loadLogs(limit, category) {
  let path = '/logs?limit=' + (limit || 500);
  if (category && category !== 'all') path += '&category=' + category;
  return api(path);
}

export async function addLog(type, category, detail, project) {
  return api('/logs', {
    method: 'POST',
    body: JSON.stringify({ type, category, detail, project })
  });
}

// ═══ ARCHIVE ═══
export async function loadArchive() {
  return api('/archive');
}

// ═══ UTILS ═══
export { getToken, setToken };
