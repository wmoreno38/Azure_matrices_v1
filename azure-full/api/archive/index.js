import { query } from '../lib/db.js';
import { requireAuth, handleOptions, jsonResponse } from '../lib/auth.js';

export default async function handler(context, req) {
  if (handleOptions(req, context)) return;

  const user = await requireAuth(req, context);
  if (!user) return;

  if (req.method === 'GET') {
    const projects = await query(
      'SELECT * FROM projects WHERE archived_at IS NOT NULL ORDER BY archived_at DESC'
    );
    if (!projects.length) return jsonResponse(context, []);

    const ids         = projects.map(p => p.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');

    const [controls, evidences, evidenceFiles] = await Promise.all([
      query(`SELECT * FROM controls  WHERE project_id IN (${placeholders}) ORDER BY sort_order`, ids),
      query(`SELECT * FROM evidences WHERE project_id IN (${placeholders})`, ids),
      query(`SELECT * FROM evidence_files WHERE evidence_id IN (
               SELECT id FROM evidences WHERE project_id IN (${placeholders})
             )`, ids)
    ]);

    const filesByEvidence = {};
    for (const f of evidenceFiles) {
      if (!filesByEvidence[f.evidence_id]) filesByEvidence[f.evidence_id] = [];
      filesByEvidence[f.evidence_id].push(f);
    }

    const storageBase = `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER || 'evidencias'}`;

    const result = projects.map(p => ({
      id: p.id, name: p.name, publishDate: p.publish_date,
      responsible: p.responsible, createdAt: p.created_at,
      archivedAt: p.archived_at, finalizedBy: p.finalized_by,
      finalizedByRole: p.finalized_by_role, stats: p.stats || {},
      controls: controls.filter(c => c.project_id === p.id).map(c => ({
        id: c.id, code: c.code, causaBase: c.causa_base,
        causasAsociadas: c.causas_asociadas, controlBase: c.control_base,
        compliance: c.compliance || '', riNiv: c.ri_niv, rrNiv: c.rr_niv,
        normatividad: c.normatividad || {}
      })),
      evidences: evidences.filter(e => e.project_id === p.id).map(e => ({
        id: e.id, controlId: e.control_id, type: e.type, description: e.description,
        date: e.date, notes: e.notes, reviewer: e.reviewer, status: e.status,
        createdAt: e.created_at,
        files: (filesByEvidence[e.id] || []).map(f => ({
          id: f.id, name: f.name, type: f.type, size: f.size,
          storagePath: f.storage_path,
          data: `${storageBase}/${f.storage_path}`
        }))
      }))
    }));

    return jsonResponse(context, result);
  }

  return jsonResponse(context, 405, { error: 'Method not allowed' });
}
