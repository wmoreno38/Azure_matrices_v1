import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Lee el token de varias fuentes (Azure SWA intercepta Authorization)
function getAuthHeader(req) {
  if (!req?.headers) return '';
  const get = (name) => {
    if (typeof req.headers.get === 'function') {
      return req.headers.get(name) || req.headers.get(name.toLowerCase()) || '';
    }
    return req.headers[name] || req.headers[name.toLowerCase()] || '';
  };
  // Prioridad: header propio que SWA no toca, luego Authorization
  const custom = get('x-auth-token');
  if (custom) return custom;
  return get('Authorization');
}

export function getUser(req) {
  const raw = getAuthHeader(req);
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.userId) return null;
  return {
    id:            payload.userId,
    role:          payload.role || 'viewer',
    name:          payload.name || '',
    username:      payload.username || '',
    email:         payload.email || '',
    project_perms: payload.project_perms || {},
  };
}

export function requireAuth(req) {
  const user = getUser(req);
  if (!user) return { user: null, error: json401('No autenticado') };
  return { user, error: null };
}

export function requireAdmin(req) {
  const { user, error } = requireAuth(req);
  if (error) return { user: null, error };
  if (user.role !== 'admin') return { user: null, error: json403('Solo administradores') };
  return { user, error: null };
}

const CORS = {
  'Access-Control-Allow-Origin':  process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-auth-token',
  'Content-Type': 'application/json',
};

export function jsonOk(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: CORS });
}

export function json201(body) {
  return new Response(JSON.stringify(body), { status: 201, headers: CORS });
}

export function json400(msg) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: CORS });
}

export function json401(msg = 'No autenticado') {
  return new Response(JSON.stringify({ error: msg }), { status: 401, headers: CORS });
}

export function json403(msg = 'Prohibido') {
  return new Response(JSON.stringify({ error: msg }), { status: 403, headers: CORS });
}

export function json404(msg = 'No encontrado') {
  return new Response(JSON.stringify({ error: msg }), { status: 404, headers: CORS });
}

export function json405() {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
}

export function json423(msg) {
  return new Response(JSON.stringify({ error: msg }), { status: 423, headers: CORS });
}

export function json500(msg = 'Error interno del servidor') {
  return new Response(JSON.stringify({ error: msg }), { status: 500, headers: CORS });
}

export function optionsOk() {
  return new Response('', { status: 200, headers: CORS });
}
