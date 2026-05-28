import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projects as projectsApi, archive as archiveApi } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'];

export default function Dashboard() {
  const [active, setActive]     = useState([]);
  const [archived, setArchived] = useState([]);
  const [loading, setLoading]   = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([projectsApi.list(), archiveApi.list()])
      .then(([a, b]) => { setActive(a); setArchived(b); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Todas las matrices (activas + finalizadas)
  const all = [...active, ...archived];

  // KPIs sobre TODAS las matrices
  const totalControls  = all.reduce((s, p) => s + (p.controls?.length || 0), 0);
  const filledControls = all.reduce((s, p) => s + (p.controls?.filter(c => c.compliance?.trim()).length || 0), 0);
  const totalEvs       = all.reduce((s, p) => s + (p.evidences?.length || 0), 0);
  const approvedEvs    = all.reduce((s, p) => s + (p.evidences?.filter(e => e.status === 'aprobada').length || 0), 0);
  const completionPct  = totalControls ? Math.round((filledControls / totalControls) * 100) : 0;

  // Gráfica: avance por proyecto (activos)
  const projectChart = active.slice(0, 8).map(p => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name,
    documentados: p.controls?.filter(c => c.compliance?.trim()).length || 0,
    total: p.controls?.length || 0,
  }));

  // Gráfica: estado de evidencias (todas)
  const statusData = [
    { name: 'Aprobadas',   value: approvedEvs },
    { name: 'En revisión', value: all.reduce((s, p) => s + (p.evidences?.filter(e => e.status === 'en_revision').length || 0), 0) },
    { name: 'Rechazadas',  value: all.reduce((s, p) => s + (p.evidences?.filter(e => e.status === 'rechazada').length || 0), 0) },
  ].filter(d => d.value > 0);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando dashboard...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <div className="subtitle">
            {user?.name?.split(' ')[0] || user?.username} ·{' '}
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* KPIs — activas + finalizadas */}
        <div className="kpi-grid">
          <div className="kpi-card orange">
            <div className="kpi-label">Matrices activas</div>
            <div className="kpi-value">{active.length}</div>
            <div className="kpi-sub">{archived.length} finalizadas en archivo</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Controles documentados</div>
            <div className="kpi-value">{filledControls}<span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>/{totalControls}</span></div>
            <div className="progress-bar" style={{ marginTop: 4 }}>
              <div className="progress-fill" style={{ width: completionPct + '%' }} />
            </div>
            <div className="kpi-sub">{completionPct}% completado (activas + archivo)</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Evidencias totales</div>
            <div className="kpi-value">{totalEvs}</div>
            <div className="kpi-sub">{approvedEvs} aprobadas</div>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-label">Tasa de aprobación</div>
            <div className="kpi-value">{totalEvs ? Math.round((approvedEvs / totalEvs) * 100) : 0}%</div>
            <div className="kpi-sub">evidencias aprobadas</div>
          </div>
        </div>

        {/* Badges de estado general */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)' }} />
            <span style={{ fontSize: '.82rem', fontWeight: 600 }}>{active.length} activas</span>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: '.82rem', fontWeight: 600 }}>{archived.length} finalizadas</span>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--info)' }} />
            <span style={{ fontSize: '.82rem', fontWeight: 600 }}>{all.length} total de matrices</span>
          </div>
        </div>

        <div className="charts-grid">
          {/* Avance activas */}
          {projectChart.length > 0 && (
            <div className="chart-card">
              <h3>Controles por proyecto activo</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={projectChart} margin={{ left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="documentados" name="Documentados" fill="var(--orange)" radius={[4,4,0,0]} />
                  <Bar dataKey="total" name="Total" fill="var(--border)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Estado evidencias */}
          {statusData.length > 0 && (
            <div className="chart-card">
              <h3>Estado de evidencias (todas las matrices)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tabla proyectos activos */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Proyectos activos</span>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects')}>Ver todos</button>
          </div>
          <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
            <table>
              <thead><tr><th>Proyecto</th><th>Responsable</th><th>Controles</th><th>Evidencias</th><th>Avance</th></tr></thead>
              <tbody>
                {active.slice(0, 5).map(p => {
                  const filled = p.controls?.filter(c => c.compliance?.trim()).length || 0;
                  const total  = p.controls?.length || 0;
                  const pct    = total ? Math.round((filled / total) * 100) : 0;
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                      <td><strong>{p.name}</strong></td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.responsible || '—'}</td>
                      <td><span className="font-mono">{filled}/{total}</span></td>
                      <td><span className="badge badge-blue">{p.evidences?.length || 0}</span></td>
                      <td style={{ minWidth: 100 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: pct+'%', background: pct===100?'var(--success)':'var(--orange)' }} />
                          </div>
                          <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', width: 30 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {active.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No hay proyectos activos</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla matrices finalizadas recientes */}
        {archived.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Matrices finalizadas recientes</span>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/archive')}>Ver archivo</button>
            </div>
            <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
              <table>
                <thead><tr><th>Proyecto</th><th>Finalizado por</th><th>Fecha</th><th>Controles</th><th>Evidencias</th></tr></thead>
                <tbody>
                  {archived.slice(0, 3).map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>{p.finalizedBy || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '.75rem' }}>{new Date(p.archivedAt).toLocaleDateString('es-CO')}</td>
                      <td><span className="badge badge-green">{p.controls?.length || 0}/33 ✓</span></td>
                      <td><span className="badge badge-blue">{p.evidences?.length || 0}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
