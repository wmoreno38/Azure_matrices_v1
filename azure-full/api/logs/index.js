import { query } from '../lib/db.js';
import { requireAuth, handleOptions, jsonResponse } from '../lib/auth.js';

export default async function handler(context, req) {
  if (handleOptions(req, context)) return;

  const user = await requireAuth(req, context);
  if (!user) return;

  if (req.method === 'GET') {
    if (user.role !== 'admin')
      return jsonResponse(context, 403, { error: 'Solo administradores' });

    const limit    = parseInt(req.query.limit) || 500;
    const category = req.query.category;

    const params = [limit];
    const where  = category && category !== 'all'
      ? `WHERE category=$${params.push(category) && params.length}` : '';

    const rows = await query(
      `SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT $1`, params
    );

    return jsonResponse(context, rows.map(l => ({
      id: l.id, timestamp: l.timestamp, type: l.type, category: l.category,
      user: l.user_name, userId: l.user_id, detail: l.detail, project: l.project
    })));
  }

  if (req.method === 'POST') {
    const { type, category, detail, project } = req.body || {};
    await query(
      `INSERT INTO audit_logs (type,category,user_name,user_id,detail,project)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [type || 'SYSTEM', category || 'Sistema', user.name, user.id, detail || '', project || '']
    );
    return jsonResponse(context, { success: true });
  }

  return jsonResponse(context, 405, { error: 'Method not allowed' });
}
