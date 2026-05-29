import { app } from '@azure/functions';
import { query, queryOne } from '../lib/db.js';
import { requireAuth, jsonOk, json400, json405, json500, optionsOk } from '../lib/auth.js';

app.http('controls', {
  methods:   ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route:     'controls/{id}',
  handler:   controlsHandler,
});

async function controlsHandler(req, context) {
  if (req.method === 'OPTIONS') return optionsOk();

  const { user, error } = requireAuth(req);
  if (error) return error;

  const id = context.triggerMetadata?.routeParams?.id || req.params?.id;
  if (!id) return json400('ID requerido');

  try {
    if (req.method === 'PUT') {
      const body = await req.json().catch(() => ({}));
      const { compliance } = body;

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

      return jsonOk({ success: true });
    }

    return json405();

  } catch (err) {
    context.error('controls error:', err);
    return json500(err.message);
  }
}
