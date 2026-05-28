import React, { useEffect, useState } from 'react';
import { archive as archiveApi } from '../api/client.js';
import { exportMatriz } from '../utils/exportMatriz.js';

const RISK_COLORS = { Extremo: 'badge-red', Alto: 'badge-red', Medio: 'badge-yellow', Bajo: 'badge-green' };

export default function Archive() {
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch]     = useState('');
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    archiveApi.list().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.responsible || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.finalizedBy || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = async (p) => {
    setExporting(p.id);
    setExportError('');
    try {
      await exportMatriz(p);
    } catch (e) {
      setExportError(`Error al exportar "${p.name}": ${e.message}`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando archivo...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Archivo</h2>
          <div className="subtitle">{data.length} matrices finalizadas</div>
        </div>
      </div>

      <div className="page-body">
        {exportError && (
          <div className="alert alert-error mb-4" style={{ marginBottom: 16 }}>
            {exportError}
            <button style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }} onClick={() => setExportError('')}>✕</button>
          </div>
        )}

        <div className="toolbar">
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input className="form-control" placeholder="Buscar en archivo..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty card" style={{ padding: 60 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>
            <p>No hay matrices archivadas aún</p>
          </div>
        ) : (
          <div className="table-wrap card">
            <table>
              <thead>
                <tr><th>Proyecto</th><th>Responsable</th><th>Finalizado por</th><th>Fecha archivo</th><th>Controles</th><th>Evidencias</th><th>Avance</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <button className="btn btn-ghost" style={{ padding: '4px 0', fontWeight: 600, color: 'var(--text)' }} onClick={() => setSelected(selected?.id === p.id ? null : p)}>
                        {p.name}
                      </button>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>{p.responsible || '—'}</td>
                    <td style={{ fontSize: '.82rem' }}>
                      {p.finalizedBy || '—'}
                      {p.finalizedByRole && <span className="chip" style={{ marginLeft: 6, fontSize: '.65rem' }}>{p.finalizedByRole}</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '.75rem' }}>{new Date(p.archivedAt).toLocaleDateString('es-CO')}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{(p.controls || []).filter(c => c.compliance?.trim()).length}/{p.controls?.length || 0}</td>
                    <td><span className="badge badge-blue">{p.evidences?.length || 0}</span></td>
                    <td><span className="badge badge-green">{p.stats?.pct ?? 100}%</span></td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => handleExport(p)} disabled={exporting === p.id}>
                        {exporting === p.id ? '⏳ Exportando…' : (
                          <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> Exportar</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div>
                <span className="card-title">Detalle: {selected.name}</span>
                <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginLeft: 12 }}>
                  Finalizado el {new Date(selected.archivedAt).toLocaleDateString('es-CO')} por {selected.finalizedBy}
                </span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="card-body">
              <DetailTabs project={selected} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function DetailTabs({ project }) {
  const [tab, setTab]   = useState('controls');
  const controls  = project.controls  || [];
  const evidences = project.evidences || [];

  return (
    <>
      <div className="tabs">
        <button className={`tab ${tab === 'controls' ? 'active' : ''}`} onClick={() => setTab('controls')}>Controles ({controls.length})</button>
        <button className={`tab ${tab === 'evidences' ? 'active' : ''}`} onClick={() => setTab('evidences')}>Evidencias ({evidences.length})</button>
      </div>

      {tab === 'controls' && (
        <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table>
            <thead><tr><th>Código</th><th>Causa base</th><th>Control base</th><th>RI</th><th>RR</th><th>Cumplimiento</th></tr></thead>
            <tbody>
              {controls.map(c => (
                <tr key={c.id}>
                  <td><span className="chip" style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--orange)' }}>{c.code}</span></td>
                  <td style={{ fontSize: '.8rem', maxWidth: 180 }}>{c.causaBase}</td>
                  <td style={{ fontSize: '.8rem', maxWidth: 220, whiteSpace: 'pre-line' }}>{c.controlBase?.substring(0, 160)}{c.controlBase?.length > 160 ? '…' : ''}</td>
                  <td><span className={`badge ${RISK_COLORS[c.riNiv] || 'badge-gray'}`}>{c.riNiv}</span></td>
                  <td><span className={`badge ${RISK_COLORS[c.rrNiv] || 'badge-gray'}`}>{c.rrNiv}</span></td>
                  <td style={{ fontSize: '.78rem', maxWidth: 260, color: c.compliance ? 'var(--text)' : 'var(--text-light)', fontStyle: c.compliance ? 'normal' : 'italic' }}>
                    {c.compliance || 'Sin documentar'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'evidences' && (
        evidences.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}><p>No hay evidencias registradas</p></div>
        ) : (
          <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table>
              <thead><tr><th>Control</th><th>Tipo</th><th>Descripción</th><th>Fecha</th><th>Estado</th><th>Revisor</th><th>Archivos</th></tr></thead>
              <tbody>
                {evidences.map(ev => {
                  const ctrl = controls.find(c => c.id === ev.controlId);
                  return (
                    <tr key={ev.id}>
                      <td><span className="chip" style={{ fontFamily: 'var(--mono)', color: 'var(--orange)' }}>{ctrl?.code || '—'}</span></td>
                      <td><span className="badge badge-blue">{ev.type}</span></td>
                      <td style={{ fontSize: '.82rem', maxWidth: 220 }}>{ev.description}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '.75rem' }}>{ev.date ? new Date(ev.date).toLocaleDateString('es-CO') : '—'}</td>
                      <td><span className={`badge ${ev.status === 'aprobada' ? 'badge-green' : ev.status === 'rechazada' ? 'badge-red' : 'badge-yellow'}`}>{ev.status === 'aprobada' ? 'Aprobada' : ev.status === 'rechazada' ? 'Rechazada' : 'En revisión'}</span></td>
                      <td style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{ev.reviewer || '—'}</td>
                      <td>{(ev.files || []).map(f => <a key={f.id} href={f.data} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '.7rem' }}>📎 {f.name}</a>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}
