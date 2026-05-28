import React, { useEffect, useState } from 'react';
import { projects as projectsApi, archive as archiveApi } from '../api/client.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';

const COLORS_PIE = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];
const RISK_COLORS_HEX = { Extremo: '#ef4444', Alto: '#ef4444', Medio: '#f59e0b', Bajo: '#22c55e' };

export default function Reports() {
  const [active, setActive]     = useState([]);
  const [archived, setArchived] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [scope, setScope]       = useState('all');    // all | active | archived
  const [selectedId, setSelectedId] = useState('');   // proyecto específico

  useEffect(() => {
    Promise.all([projectsApi.list(), archiveApi.list()])
      .then(([a, b]) => { setActive(a); setArchived(b); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const all = [...active, ...archived];

  // Proyectos según filtro
  const pool = scope === 'active' ? active : scope === 'archived' ? archived : all;
  const projects = selectedId ? pool.filter(p => p.id === selectedId) : pool;

  const allControls = projects.flatMap(p => (p.controls || []).map(c => ({ ...c, projectName: p.name })));
  const allEvs      = projects.flatMap(p => (p.evidences || []).map(e => ({ ...e, projectName: p.name })));

  const filledControls = allControls.filter(c => c.compliance?.trim()).length;
  const totalControls  = allControls.length;
  const completionPct  = totalControls ? Math.round((filledControls / totalControls) * 100) : 0;
  const approved       = allEvs.filter(e => e.status === 'aprobada').length;

  // Gráfica avance por proyecto
  const projectProgress = projects.slice(0, 10).map(p => {
    const total  = p.controls?.length || 0;
    const filled = p.controls?.filter(c => c.compliance?.trim()).length || 0;
    return { name: p.name.slice(0, 18), avance: total ? Math.round((filled / total) * 100) : 0, tipo: archived.find(a => a.id === p.id) ? 'Finalizada' : 'Activa' };
  });

  // Distribución de riesgo
  const riskDist = ['Extremo', 'Alto', 'Medio', 'Bajo'].map(r => ({
    name: r, value: allControls.filter(c => c.riNiv === r).length
  })).filter(d => d.value > 0);

  // Estado evidencias
  const evStatus = [
    { name: 'Aprobadas',   value: allEvs.filter(e => e.status === 'aprobada').length },
    { name: 'En revisión', value: allEvs.filter(e => e.status === 'en_revision').length },
    { name: 'Rechazadas',  value: allEvs.filter(e => e.status === 'rechazada').length },
  ].filter(d => d.value > 0);

  // RI vs RR
  const rirrData = ['Extremo', 'Alto', 'Medio', 'Bajo'].map(nivel => ({
    nivel,
    RI: allControls.filter(c => c.riNiv === nivel).length,
    RR: allControls.filter(c => c.rrNiv === nivel).length,
  })).filter(d => d.RI > 0 || d.RR > 0);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Hoja resumen
    const resumen = [
      ['Reporte Línea 1.5 — Gestión de Riesgos TI'],
      ['Fecha', new Date().toLocaleDateString('es-CO')],
      ['Alcance', scope === 'all' ? 'Todas las matrices' : scope === 'active' ? 'Solo activas' : 'Solo finalizadas'],
      [],
      ['RESUMEN'],
      ['Total matrices', projects.length],
      ['  Activas', active.length],
      ['  Finalizadas', archived.length],
      ['Total controles', totalControls],
      ['Controles documentados', filledControls],
      ['% Avance general', completionPct + '%'],
      ['Total evidencias', allEvs.length],
      ['Evidencias aprobadas', approved],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');

    // Hoja controles
    const ctrlRows = [['Proyecto', 'Estado Matriz', 'Código', 'Causa Base', 'Control Base', 'RI', 'RR', 'Cumplimiento', 'Evidencias']];
    allControls.forEach(c => {
      const isArchived = archived.find(a => a.name === c.projectName);
      const evCount = allEvs.filter(e => e.controlId === c.id).length;
      ctrlRows.push([c.projectName, isArchived ? 'Finalizada' : 'Activa', c.code, c.causaBase, c.controlBase, c.riNiv, c.rrNiv, c.compliance || '', evCount]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ctrlRows), 'Controles');

    // Hoja evidencias
    const evRows = [['Proyecto', 'Estado Matriz', 'Control', 'Tipo', 'Descripción', 'Fecha', 'Estado', 'Revisor']];
    allEvs.forEach(e => {
      const ctrl = allControls.find(c => c.id === e.controlId);
      const isArchived = archived.find(a => a.name === e.projectName);
      evRows.push([e.projectName, isArchived ? 'Finalizada' : 'Activa', ctrl?.code || '—', e.type, e.description, e.date || '', e.status, e.reviewer || '']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(evRows), 'Evidencias');

    XLSX.writeFile(wb, `Linea15_Reporte_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando reportes...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Reportes</h2>
          <div className="subtitle">Análisis global — activas y finalizadas</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filtro alcance */}
          <select className="form-control" style={{ width: 'auto' }} value={scope} onChange={e => { setScope(e.target.value); setSelectedId(''); }}>
            <option value="all">Todas las matrices ({all.length})</option>
            <option value="active">Solo activas ({active.length})</option>
            <option value="archived">Solo finalizadas ({archived.length})</option>
          </select>
          {/* Filtro proyecto individual */}
          <select className="form-control" style={{ width: 'auto' }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {pool.map(p => <option key={p.id} value={p.id}>{p.name}{archived.find(a => a.id === p.id) ? ' ✓' : ''}</option>)}
          </select>
          <button className="btn btn-primary" onClick={exportExcel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <div className="kpi-card orange">
            <div className="kpi-label">Matrices en reporte</div>
            <div className="kpi-value">{projects.length}</div>
            <div className="kpi-sub">{projects.filter(p => archived.find(a=>a.id===p.id)).length} finalizadas · {projects.filter(p => !archived.find(a=>a.id===p.id)).length} activas</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Controles documentados</div>
            <div className="kpi-value">{completionPct}%</div>
            <div className="progress-bar" style={{ marginTop: 4 }}><div className="progress-fill" style={{ width: completionPct+'%' }} /></div>
            <div className="kpi-sub">{filledControls}/{totalControls}</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Evidencias</div>
            <div className="kpi-value">{allEvs.length}</div>
            <div className="kpi-sub">{approved} aprobadas</div>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-label">Controles alto riesgo</div>
            <div className="kpi-value">{allControls.filter(c => c.riNiv === 'Alto' || c.riNiv === 'Extremo').length}</div>
            <div className="kpi-sub">Extremo + Alto</div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-card" style={{ gridColumn: 'span 2' }}>
            <h3>Avance por proyecto (%)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projectProgress} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={v => v + '%'} />
                <Bar dataKey="avance" name="Avance" radius={[4,4,0,0]}>
                  {projectProgress.map((d, i) => <Cell key={i} fill={d.avance===100 ? '#22c55e' : d.tipo==='Finalizada' ? '#8b5cf6' : 'var(--orange)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '.72rem', color: 'var(--text-muted)' }}>
              <span><span style={{ color: 'var(--orange)' }}>■</span> Activa en progreso</span>
              <span><span style={{ color: '#8b5cf6' }}>■</span> Finalizada</span>
              <span><span style={{ color: '#22c55e' }}>■</span> 100% completado</span>
            </div>
          </div>

          <div className="chart-card">
            <h3>Distribución de Riesgo Inherente</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={riskDist} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {riskDist.map((d, i) => <Cell key={i} fill={RISK_COLORS_HEX[d.name] || COLORS_PIE[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Estado de evidencias</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={evStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="value">
                  {evStatus.map((_, i) => <Cell key={i} fill={COLORS_PIE[i]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card" style={{ gridColumn: 'span 2' }}>
            <h3>Comparativo Riesgo Inherente vs Residual</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rirrData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="nivel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip /><Legend />
                <Bar dataKey="RI" name="Riesgo Inherente" fill="var(--orange)" radius={[4,4,0,0]} />
                <Bar dataKey="RR" name="Riesgo Residual"  fill="var(--info)"   radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Controles pendientes */}
        {allControls.filter(c => !c.compliance?.trim()).length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Controles pendientes de documentar</span>
              <span className="badge badge-red">{allControls.filter(c => !c.compliance?.trim()).length}</span>
            </div>
            <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
              <table>
                <thead><tr><th>Proyecto</th><th>Estado</th><th>Código</th><th>Causa base</th><th>RI</th></tr></thead>
                <tbody>
                  {allControls.filter(c => !c.compliance?.trim()).slice(0, 15).map(c => {
                    const isArch = archived.find(a => a.name === c.projectName);
                    return (
                      <tr key={c.id}>
                        <td style={{ fontSize: '.8rem' }}>{c.projectName}</td>
                        <td><span className={`badge ${isArch ? 'badge-green' : 'badge-orange'}`}>{isArch ? 'Finalizada' : 'Activa'}</span></td>
                        <td><span className="chip" style={{ fontFamily: 'var(--mono)', color: 'var(--orange)' }}>{c.code}</span></td>
                        <td style={{ fontSize: '.8rem' }}>{c.causaBase}</td>
                        <td><span className={`badge ${c.riNiv==='Alto'||c.riNiv==='Extremo'?'badge-red':c.riNiv==='Medio'?'badge-yellow':'badge-green'}`}>{c.riNiv}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
