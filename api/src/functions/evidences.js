import { app } from '@azure/functions';
import { query, queryOne, insert } from '../lib/db.js';
import { uploadBlob, deleteBlobs } from '../lib/storage.js';
import { requireAuth, jsonOk, json400, json405, json500, optionsOk } from '../lib/auth.js';

function safeName(name) {
  const parts = (name || 'archivo').split('.');
  const ext   = parts.length > 1 ? '.' + parts.pop() : '';
  const base  = parts.join('.')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_').substring(0, 100);
  return base + ext;
}

async function getEvInfo(id) {
  const ev = await queryOne(
    'SELECT description, control_id, project_id FROM evidences WHERE id=$1', [id]
  );
  let ctrlCode = '', projName = '';
  if (ev?.control_id) {
    const c = await queryOne('SELECT code FROM controls WHERE id=$1', [ev.control_id]);
    ctrlCode = c?.code || '';
  }
  if (ev?.project_id) {
    const p = await queryOne('SELECT name FROM projects WHERE id=$1', [ev.project_id]);
    projName = p?.name || '';
  }
  return { description: ev?.description || '', ctrlCode, projName };
}

app.http('evidences', {
  methods:   ['POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route:     'evidences/{id?}',
  handler:   evidencesHandler,
});

async function evidencesHandler(req, context) {
  if (req.method === 'OPTIONS') return optionsOk();

  const { user, error } = requireAuth(req);
  if (error) return error;

  const id = context.triggerMetadata?.routeParams?.id || req.params?.id;

  try {
    // POST /api/evidences — crear
    if (req.method === 'POST' && !id) {
      const body = await req.json().catch(() => ({}));
      const { projectId, controlId, type, description, date, notes, reviewer, files } = body;
      if (!projectId || !controlId || !description)
        return json400('projectId, controlId y description son requeridos');

      const ev = await insert(
        `INSERT INTO evidences
           (project_id, control_id, type, description, date, notes, reviewer, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'en_revision')`,
        [projectId, controlId, type || 'Documento', description,
         date || null, notes || '', reviewer || '']
      );

      if (files?.length) {
        for (const f of files) {
          if (!f.data) continue;
          try {
            const safe       = safeName(f.name);
            const blobPath   = `${projectId}/${controlId}/${ev.id}/${safe}`;
            const base64Data = f.data.split(',')[1] || f.data;
            const buffer     = Buffer.from(base64Data, 'base64');
            await uploadBlob(blobPath, buffer, f.type || 'application/octet-stream');
            await query(
              `INSERT INTO evidence_files (evidence_id, name, type, size, storage_path)
               VALUES ($1,$2,$3,$4,$5)`,
              [ev.id, f.name, f.type || '', buffer.length, blobPath]
            );
          } catch (err) {
            console.error('Error subiendo archivo:', err.message);
          }
        }
      }

      const ctrl = await queryOne('SELECT code FROM controls WHERE id=$1', [controlId]);
      const proj = await queryOne('SELECT name FROM projects WHERE id=$1', [projectId]);
      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail,project)
         VALUES ('EVIDENCE_ADD','Evidencia',$1,$2,$3,$4)`,
        [user.name, user.id,
         `Evidencia agregada: ${description} → ${ctrl?.code || ''}`, proj?.name || '']
      );

      return jsonOk({ id: ev.id, success: true });
    }

    // PUT /api/evidences/{id} — actualizar
    if (req.method === 'PUT' && id) {
      const body = await req.json().catch(() => ({}));
      const { status, type, description, date, notes, reviewer } = body;

      const fields = [];
      const params = [];
      let   p      = 1;

      if (status      !== undefined) { fields.push(`status=$${p++}`);      params.push(status); }
      if (status      !== undefined) { fields.push(`reviewer=$${p++}`);    params.push(reviewer || user.name); }
      if (type        !== undefined) { fields.push(`type=$${p++}`);        params.push(type); }
      if (description !== undefined) { fields.push(`description=$${p++}`); params.push(description); }
      if (date        !== undefined) { fields.push(`date=$${p++}`);        params.push(date); }
      if (notes       !== undefined) { fields.push(`notes=$${p++}`);       params.push(notes); }
      if (reviewer    !== undefined && status === undefined) {
        fields.push(`reviewer=$${p++}`); params.push(reviewer);
      }

      if (fields.length) {
        params.push(id);
        await query(`UPDATE evidences SET ${fields.join(',')} WHERE id=$${p}`, params);
      }

      const info    = await getEvInfo(id);
      const logType = status === 'aprobada'  ? 'EVIDENCE_APPROVE'
                    : status === 'rechazada' ? 'EVIDENCE_REJECT' : 'EVIDENCE_EDIT';
      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail,project)
         VALUES ($1,'Evidencia',$2,$3,$4,$5)`,
        [logType, user.name, user.id,
         `Evidencia ${status === 'aprobada' ? 'aprobada' : status === 'rechazada' ? 'rechazada' : 'editada'}: ${info.description} → ${info.ctrlCode}`,
         info.projName]
      );

      return jsonOk({ success: true });
    }

    // DELETE /api/evidences/{id}
    if (req.method === 'DELETE' && id) {
      const info  = await getEvInfo(id);
      const files = await query(
        'SELECT storage_path FROM evidence_files WHERE evidence_id=$1', [id]
      );
      if (files.length) await deleteBlobs(files.map(f => f.storage_path));
      await query('DELETE FROM evidences WHERE id=$1', [id]);
      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail,project)
         VALUES ('EVIDENCE_DELETE','Evidencia',$1,$2,$3,$4)`,
        [user.name, user.id, `Evidencia eliminada: ${info.description}`, info.projName]
      );
      return jsonOk({ success: true });
    }

    return json405();

  } catch (err) {
    context.error('evidences error:', err);
    return json500(err.message);
  }
}
