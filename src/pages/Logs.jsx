import React, { useEffect, useState } from 'react';
import { logs as logsApi } from '../api/client.js';

const CATEGORY_COLORS = {
  Acceso: 'badge-blue', Proyecto: 'badge-orange', Control: 'badge-yellow',
  Evidencia: 'badge-green', Usuarios: 'badge-red', Sistema: 'badge-gray',
};

export default function Logs() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(200);

  const load = () => {
    setLoading(true);
    const params = { limit };
    if (category !== 'all') params.category = category;
    logsApi.list(params).then(setData).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, [category, limit]);

  const filtered = data.filter(l => {
    const q = search.toLowerCase();
    return !q || l.detail?.toLowerCase().includes(q) || l.user?.toLowerCase().includes(q) || l.project?.toLowerCase().includes(q);
  });

  const categories = ['all', ...new Set(data.map(l => l.category).filter(Boolean))];

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Auditoría</h2>
          <div className="subtitle">{data.length} registros</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Actualizar
        </button>
      </div>

      <div className="page-body">
        <div className="toolbar">
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input className="form-control" placeholder="Buscar en logs..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 'auto' }} value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'Todas las categorías' : c}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={limit} onChange={e => setLimit(+e.target.value)}>
            <option value={100}>100 registros</option>
            <option value={200}>200 registros</option>
            <option value={500}>500 registros</option>
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando logs...</div>
        ) : (
          <div className="table-wrap card">
            <table>
              <thead>
                <tr><th>Fecha/Hora</th><th>Categoría</th><th>Tipo</th><th>Usuario</th><th>Detalle</th><th>Proyecto</th></tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(l.timestamp).toLocaleString('es-CO')}
                    </td>
                    <td><span className={`badge ${CATEGORY_COLORS[l.category] || 'badge-gray'}`}>{l.category}</span></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '.75rem', color: 'var(--text-muted)' }}>{l.type}</td>
                    <td style={{ fontSize: '.82rem', fontWeight: 500 }}>{l.user || '—'}</td>
                    <td style={{ fontSize: '.82rem', maxWidth: 300 }}>{l.detail}</td>
                    <td style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{l.project || '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                      <p>No hay registros</p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
