import { app } from '@azure/functions';
import { query } from '../lib/db.js';
import { requireAuth, jsonOk, json403, json405, json500, optionsOk } from '../lib/auth.js';

app.http('logs', {
  methods:   ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route:     'logs',
  handler:   logsHandler,
});

async function logsHandler(req, context) {
  if (req.method === 'OPTIONS') return optionsOk();

  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    if (req.method === 'GET') {
      if (user.role !== 'admin')
        return json403('Solo administradores');

      const url      = new URL(req.url);
      const limit    = parseInt(url.searchParams.get('limit')) || 500;
      const category = url.searchParams.get('category');

      const params = [limit];
      const where  = category && category !== 'all'
        ? `WHERE category=$${params.push(category) && params.length}` : '';

      const rows = await query(
        `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $1`, params
      );

      return jsonOk(rows.map(l => ({
        id:        l.id,
        timestamp: l.created_at,   // alias para el frontend
        type:      l.type,
        category:  l.category,
        user:      l.user_name,
        userId:    l.user_id,
        detail:    l.detail,
        project:   l.project,
      })));
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { type, category, detail, project } = body;
      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail,project)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [type || 'SYSTEM', category || 'Sistema', user.name, user.id,
         detail || '', project || '']
      );
      return jsonOk({ success: true });
    }

    return json405();

  } catch (err) {
    context.error('logs error:', err);
    return json500(err.message);
  }
}
