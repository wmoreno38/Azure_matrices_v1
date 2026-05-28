import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projects as api } from '../api/client.js';
import { DEFAULT_CONTROLS } from '../data/defaultControls.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Projects() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [delModal, setDelModal] = useState(null);
  const [form, setForm] = useState({ name: '', publishDate: '', responsible: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const load = () => {
    setLoading(true);
    api.list().then(setData).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = data.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.responsible || '').toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('El nombre es requerido');
    setSaving(true); setError('');
    try {
      await api.create({ ...form, controls: DEFAULT_CONTROLS });
      setModal(false); setForm({ name: '', publishDate: '', responsible: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(delModal.id);
      setDelModal(null); load();
    } catch (err) {
      alert(err.message);
    }
  };

  const completion = (p) => {
    const total = p.controls?.length || 0;
    const filled = p.controls?.filter(c => c.compliance?.trim()).length || 0;
    return total ? Math.round((filled / total) * 100) : 0;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Proyectos</h2>
          <div className="subtitle">{data.length} matrices activas</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Nuevo proyecto
        </button>
      </div>

      <div className="page-body">
        <div className="toolbar">
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input className="form-control" placeholder="Buscar proyecto o responsable..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando proyectos...</div>
        ) : (
          <div className="table-wrap card">
            <table>
              <thead>
                <tr><th>Proyecto</th><th>Responsable</th><th>Fecha publicación</th><th>Controles</th><th>Evidencias</th><th>Avance</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const pct = completion(p);
                  const filled = p.controls?.filter(c => c.compliance?.trim()).length || 0;
                  const total = p.controls?.length || 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <button className="btn btn-ghost" style={{ padding: '4px 0', fontWeight: 600, color: 'var(--text)' }} onClick={() => navigate(`/projects/${p.id}`)}>
                          {p.name}
                        </button>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.responsible || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '.78rem' }}>{p.publishDate ? new Date(p.publishDate).toLocaleDateString('es-CO') : '—'}</td>
                      <td><span className="font-mono">{filled}/{total}</span></td>
                      <td><span className="badge badge-blue">{p.evidences?.length || 0}</span></td>
                      <td style={{ minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: pct + '%', background: pct === 100 ? 'var(--success)' : 'var(--orange)' }} />
                          </div>
                          <span style={{ fontSize: '.75rem', width: 30, color: 'var(--text-muted)' }}>{pct}%</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${p.id}`)}>Abrir</button>
                          {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => setDelModal(p)}>Eliminar</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7}>
                    <div className="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h18M3 12h18M3 17h18"/></svg><p>Sin proyectos</p></div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nuevo proyecto</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-4">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Nombre del proyecto *</label>
                  <input className="form-control" placeholder="Ej: Matriz de Riesgos TI Q1 2025" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Responsable</label>
                  <input className="form-control" placeholder="Nombre del líder del proyecto" value={form.responsible} onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de publicación</label>
                  <input className="form-control" type="date" value={form.publishDate} onChange={e => setForm(f => ({ ...f, publishDate: e.target.value }))} />
                </div>
                <div className="alert alert-info">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                  Se crearán automáticamente los 33 controles estándar.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear proyecto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {delModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDelModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Confirmar eliminación</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setDelModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>¿Eliminar el proyecto <strong>{delModal.name}</strong>? Esta acción no se puede deshacer.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDelModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
