import { query, queryOne } from '../lib/db.js';
import { requireAuth, handleOptions, jsonResponse } from '../lib/auth.js';

export default async function handler(context, req) {
  if (handleOptions(req, context)) return;

  const user = await requireAuth(req, context);
  if (!user) return;

  const id = req.params.id;
  if (!id) return jsonResponse(context, 400, { error: 'ID requerido' });

  // DELETE: eliminar proyecto (en cascada elimina controles y evidencias)
  if (req.method === 'DELETE') {
    const proj = await queryOne('SELECT name FROM projects WHERE id=$1', [id]);
    await query('DELETE FROM projects WHERE id=$1', [id]);
    await query(
      `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
       VALUES ('PROJECT_DELETE','Proyecto',$1,$2,$3)`,
      [user.name, user.id, `Proyecto eliminado: ${proj?.name || id}`]
    );
    return jsonResponse(context, { success: true });
  }

  // PUT: finalizar / archivar proyecto
  if (req.method === 'PUT') {
    const { action, finalizedBy, finalizedByRole, stats } = req.body || {};

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
      return jsonResponse(context, { success: true });
    }

    return jsonResponse(context, 400, { error: 'Acción no reconocida' });
  }

  return jsonResponse(context, 405, { error: 'Method not allowed' });
}
