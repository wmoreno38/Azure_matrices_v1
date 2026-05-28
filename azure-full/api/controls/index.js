import { query, queryOne } from '../lib/db.js';
import { requireAuth, handleOptions, jsonResponse } from '../lib/auth.js';

export default async function handler(context, req) {
  if (handleOptions(req, context)) return;

  const user = await requireAuth(req, context);
  if (!user) return;

  const id = req.params.id;
  if (!id) return jsonResponse(context, 400, { error: 'ID requerido' });

  if (req.method === 'PUT') {
    const { compliance } = req.body || {};

    const ctrl = await queryOne(
      'SELECT code, project_id FROM controls WHERE id=$1', [id]
    );
    await query('UPDATE controls SET compliance=$1 WHERE id=$2', [compliance || '', id]);

    let projectName = '';
    if (ctrl?.project_id) {
      const proj = await queryOne('SELECT name FROM projects WHERE id=$1', [ctrl.project_id]);
      projectName = proj?.name || '';
    }

    const type = compliance?.trim() ? 'CONTROL_FILL' : 'CONTROL_CLEAR';
    await query(
      `INSERT INTO audit_logs (type,category,user_name,user_id,detail,project)
       VALUES ($1,'Control',$2,$3,$4,$5)`,
      [type, user.name, user.id,
       `${type === 'CONTROL_FILL' ? 'Cumplimiento documentado' : 'Cumplimiento borrado'}: ${ctrl?.code || ''}`,
       projectName]
    );

    return jsonResponse(context, { success: true });
  }

  return jsonResponse(context, 405, { error: 'Method not allowed' });
}
