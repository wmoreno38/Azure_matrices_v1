import { app }  from '@azure/functions';
import { query, queryOne, insert } from '../lib/db.js';
import { requireAuth, jsonOk, json400, json405, json500, optionsOk } from '../lib/auth.js';

// ── Mappers ─────────────────────────────────────────────────
function mapControl(c) {
  return {
    id: c.id, code: c.code, causaBase: c.causa_base,
    causasAsociadas: c.causas_asociadas, controlBase: c.control_base,
    compliance: c.compliance || '', riNiv: c.ri_niv, rrNiv: c.rr_niv,
    normatividad: c.normatividad || {},
  };
}

function mapEvidence(e, filesByEvidence, storageBase) {
  return {
    id: e.id, controlId: e.control_id, type: e.type,
    description: e.description, date: e.date, notes: e.notes,
    reviewer: e.reviewer, status: e.status, createdAt: e.created_at,
    files: (filesByEvidence[e.id] || []).map(f => ({
      id: f.id, name: f.name, type: f.type, size: f.size,
      storagePath: f.storage_path,
      data: `${storageBase}/${f.storage_path}`,
    })),
  };
}

async function loadProjects(whereClause, params) {
  const projects = await query(
    `SELECT * FROM projects WHERE ${whereClause} ORDER BY created_at DESC`, params
  );
  if (!projects.length) return [];

  const ids          = projects.map(p => p.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');

  const [controls, evidences, evidenceFiles] = await Promise.all([
    query(`SELECT * FROM controls WHERE project_id IN (${placeholders}) ORDER BY sort_order`, ids),
    query(`SELECT * FROM evidences WHERE project_id IN (${placeholders})`, ids),
    query(`SELECT * FROM evidence_files WHERE evidence_id IN (
             SELECT id FROM evidences WHERE project_id IN (${placeholders})
           )`, ids),
  ]);

  const filesByEvidence = {};
  for (const f of evidenceFiles) {
    if (!filesByEvidence[f.evidence_id]) filesByEvidence[f.evidence_id] = [];
    filesByEvidence[f.evidence_id].push(f);
  }

  const storageBase = `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER || 'evidencias'}`;

  return projects.map(p => ({
    id: p.id, name: p.name, publishDate: p.publish_date,
    responsible: p.responsible, createdAt: p.created_at,
    archivedAt: p.archived_at, finalizedBy: p.finalized_by,
    finalizedByRole: p.finalized_by_role, stats: p.stats || {},
    controls:  controls.filter(c => c.project_id === p.id).map(mapControl),
    evidences: evidences.filter(e => e.project_id === p.id)
                        .map(e => mapEvidence(e, filesByEvidence, storageBase)),
  }));
}

// ── Function registration ────────────────────────────────────
app.http('projects', {
  methods:   ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route:     'projects',
  handler:   projectsHandler,
});

async function projectsHandler(req, context) {
  if (req.method === 'OPTIONS') return optionsOk();

  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    // GET /api/projects — proyectos activos
    if (req.method === 'GET') {
      const result = await loadProjects('archived_at IS NULL', []);
      return jsonOk(result);
    }

    // POST /api/projects — crear proyecto
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { name, publishDate, responsible, controls } = body;
      if (!name) return json400('Nombre requerido');

      const proj = await insert(
        `INSERT INTO projects (name, publish_date, responsible, created_by)
         VALUES ($1, $2, $3, $4)`,
        [name, publishDate || null, responsible || null, user.id]
      );

      if (controls?.length) {
        const vals   = [];
        const params = [];
        controls.forEach((c, i) => {
          const b = i * 9;
          vals.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`);
          params.push(
            proj.id, c.code, c.causaBase || '', c.causasAsociadas || '',
            c.controlBase || '', c.riNiv || '', c.rrNiv || '',
            JSON.stringify(c.normatividad || {}), i
          );
        });
        await query(
          `INSERT INTO controls
             (project_id,code,causa_base,causas_asociadas,control_base,ri_niv,rr_niv,normatividad,sort_order)
           VALUES ${vals.join(',')}`,
          params
        );
      }

      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
         VALUES ('PROJECT_CREATE','Proyecto',$1,$2,$3)`,
        [user.name, user.id, `Proyecto creado: ${name}`]
      );

      return jsonOk({ id: proj.id, success: true });
    }

    return json405();

  } catch (err) {
    context.error('projects error:', err);
    return json500(err.message);
  }
}

// ── Export loadProjects para reutilizar en archive ───────────
export { loadProjects };
