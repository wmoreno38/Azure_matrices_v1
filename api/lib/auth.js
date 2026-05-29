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

export async function getUser(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.userId) return null;
  return {
    id: payload.userId,
    role: payload.role || 'viewer',
    name: payload.name || '',
    username: payload.username || '',
    email: payload.email || '',
    active: true,
    project_perms: payload.project_perms || {}
  };
}

export async function requireAuth(req, context) {
  const user = await getUser(req);
  if (!user) {
    jsonResponse(context, 401, { error: 'No autenticado' });
    return null;
  }
  return user;
}

export async function requireAdmin(req, context) {
  const user = await requireAuth(req, context);
  if (!user) return null;
  if (user.role !== 'admin') {
    jsonResponse(context, 403, { error: 'Solo administradores' });
    return null;
  }
  return user;
}

export function setCors(context) {
  context.res = context.res || {};
  context.res.headers = {
    ...(context.res.headers || {}),
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };
}

export function handleOptions(req, context) {
  setCors(context);
  if (req.method === 'OPTIONS') {
    context.res = { ...context.res, status: 200, body: '' };
    return true;
  }
  return false;
}

export function jsonResponse(context, statusOrBody, bodyIfStatus) {
  const isNum = typeof statusOrBody === 'number';
  context.res = {
    ...context.res,
    status: isNum ? statusOrBody : 200,
    body: JSON.stringify(isNum ? bodyIfStatus : statusOrBody),
    headers: { ...(context.res?.headers || {}), 'Content-Type': 'application/json' },
  };
}
