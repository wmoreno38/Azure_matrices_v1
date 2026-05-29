import { app } from '@azure/functions';
import { query, queryOne } from '../lib/db.js';
import { requireAuth, json400, json405, json500, optionsOk, jsonOk } from '../lib/auth.js';

app.http('projectsId', {
  methods:   ['PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route:     'projects/{id}',
  handler:   projectsIdHandler,
});

async function projectsIdHandler(req, context) {
  if (req.method === 'OPTIONS') return optionsOk();

  const { user, error } = requireAuth(req);
  if (error) return error;

  const id = context.triggerMetadata?.routeParams?.id || req.params?.id;
  if (!id) return json400('ID requerido');

  try {
    // DELETE /api/projects/{id}
    if (req.method === 'DELETE') {
      const proj = await queryOne('SELECT name FROM projects WHERE id=$1', [id]);
      await query('DELETE FROM projects WHERE id=$1', [id]);
      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
         VALUES ('PROJECT_DELETE','Proyecto',$1,$2,$3)`,
        [user.name, user.id, `Proyecto eliminado: ${proj?.name || id}`]
      );
      return jsonOk({ success: true });
    }

    // PUT /api/projects/{id} — finalizar/archivar
    if (req.method === 'PUT') {
      const body = await req.json().catch(() => ({}));
      const { action, finalizedBy, finalizedByRole, stats } = body;

      if (action === 'finalize') {
        await query(
          `UPDATE projects SET
             archived_at=$1, finalized_by=$2, finalized_by_role=$3, stats=$4
           WHERE id=$5`,
          [new Date(), finalizedBy || user.name, finalizedByRole || user.role,
           JSON.stringify(stats || {}), id]
        );
        const proj = await queryOne('SELECT name FROM projects WHERE id=$1', [id]);
        await query(
          `INSERT INTO audit_logs (type,category,user_name,user_id,detail,project)
           VALUES ('PROJECT_FINALIZE','Proyecto',$1,$2,$3,$4)`,
          [user.name, user.id, `Matriz finalizada: ${proj?.name || id}`, proj?.name || '']
        );
        return jsonOk({ success: true });
      }

      return json400('Acción no reconocida');
    }

    return json405();

  } catch (err) {
    context.error('projectsId error:', err);
    return json500(err.message);
  }
}
