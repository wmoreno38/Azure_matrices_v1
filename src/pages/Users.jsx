import React, { useEffect, useState } from 'react';
import { users as usersApi, projects as projectsApi } from '../api/client.js';
import { useAuth, APP_MODULES, extractProjectPerms } from '../contexts/AuthContext.jsx';

export const ROLES = {
  admin:    { l:'Administrador',     desc:'Acceso total al sistema',                         perms:['create_project','delete_project','fill_controls','add_evidence','approve_evidence','edit_evidence','delete_evidence','manage_users'] },
  lider:    { l:'Líder Técnico',     desc:'Gestión de proyectos y evidencias asignadas',     perms:['create_project','fill_controls','add_evidence','approve_evidence','edit_evidence','delete_evidence'] },
  analista: { l:'Analista',          desc:'Documenta controles y sube evidencias',           perms:['fill_controls','add_evidence','edit_evidence'] },
  auditor:  { l:'Auditor / Revisor', desc:'Aprueba/rechaza evidencias y ve auditoría',      perms:['approve_evidence'] },
  viewer:   { l:'Solo lectura',      desc:'Ver proyectos asignados sin modificar',           perms:[] },
};

export const ROLE_COLORS = {
  admin:'badge-red', lider:'badge-orange', analista:'badge-blue', auditor:'badge-green', viewer:'badge-gray',
};

export const PROJECT_ACCESS = {
  none:     { l:'Sin acceso',            icon:'✕', color:'#DC2626' },
  full:     { l:'Completo',              icon:'✓', color:'#2E8B57' },
  fill:     { l:'Solo llenar controles', icon:'📝', color:'#1A7AB5' },
  evidence: { l:'Solo evidencias',       icon:'📎', color:'#D97706' },
  view:     { l:'Solo ver',              icon:'👁', color:'#6B7280' },
};

function getRoleLabel(r) { return ROLES[r]?.l || r || '—'; }
function getRoleColor(r) { return ROLE_COLORS[r] || 'badge-gray'; }

// Módulos que el admin puede asignar a otros usuarios (no admin-only)
const ASSIGNABLE_MODULES = Object.entries(APP_MODULES)
  .filter(([, v]) => !v.adminOnly)
  .map(([k, v]) => ({ key: k, ...v }));

// Módulos visibles por defecto según rol
const DEFAULT_MODULES = {
  auditor:  ['dashboard','projects','reports','archive','logs'],
  lider:    ['dashboard','projects','reports','archive'],
  analista: ['dashboard','projects'],
  viewer:   ['dashboard','projects'],
};

export default function Users() {
  const [data, setData]       = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal]     = useState(null);
  const [permsModal, setPermsModal]   = useState(null);
  const [form, setForm] = useState({ email:'', password:'', username:'', name:'', role:'analista' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const { user: me } = useAuth();

  const load = () => {
    setLoading(true);
    Promise.all([usersApi.list(), projectsApi.list()])
      .then(([u, p]) => { setData(u); setProjects(p); })
      .catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try { await usersApi.create(form); setCreateModal(false); setForm({ email:'', password:'', username:'', name:'', role:'analista' }); load(); }
    catch(err) { setError(err.message); } finally { setSaving(false); }
  };

  const handleEditRole = async (userId, newRole) => {
    await usersApi.update(userId, { role: newRole }).catch(e => alert(e.message));
    load(); setEditModal(null);
  };

  const toggleActive = async u => {
    await usersApi.update(u.id, { action:'toggle', active:!u.active }).catch(e => alert(e.message)); load();
  };

  const handleDelete = async u => {
    if (!confirm(`¿Eliminar usuario ${u.name}?`)) return;
    await usersApi.delete(u.id).catch(e => alert(e.message)); load();
  };

  const savePerms = async (userId, allPerms) => {
    await usersApi.update(userId, { action:'update_perms', project_perms: allPerms }).catch(e => alert(e.message));
    load(); setPermsModal(null);
  };

  const filtered = data.filter(u => {
    const q = search.toLowerCase();
    const mq = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q);
    const mf = filter==='all' || (filter==='active'&&u.active) || (filter==='inactive'&&!u.active);
    return mq && mf;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>⚙️ Administración de Usuarios</h2>
          <div className="subtitle">Crear, editar y asignar permisos por módulo y proyecto</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateModal(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Nuevo Usuario
        </button>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          {[{k:'all',l:`${data.length} Total`,c:'var(--text)'},{k:'active',l:`${data.filter(u=>u.active).length} Activos`,c:'var(--success)'},{k:'inactive',l:`${data.filter(u=>!u.active).length} Inactivos`,c:'var(--danger)'}].map(b=>(
            <button key={b.k} onClick={()=>setFilter(b.k)}
              style={{ padding:'5px 14px', borderRadius:20, border:`1.5px solid ${filter===b.k?b.c:'var(--border)'}`, background:filter===b.k?b.c+'18':'var(--surface)', color:b.c, fontWeight:700, fontSize:'.78rem', cursor:'pointer', fontFamily:'var(--font)' }}>
              {b.l}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="search-box" style={{ marginBottom:14 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input className="form-control" placeholder="Buscar usuario..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>

        {loading ? <div style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>Cargando...</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(u => {
              const rawPerms = u.projectPerms || {};
              const projPerms = extractProjectPerms(rawPerms);
              const assignedProjs = projects.filter(p => projPerms[p.id] && projPerms[p.id] !== 'none');

              // Módulos asignados (via _mod_ prefix)
              const assignedMods = ASSIGNABLE_MODULES.filter(m => rawPerms['_mod_'+m.key] === true).map(m => m.l);

              return (
                <div key={u.id} className="card" style={{ padding:'14px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:u.id===me?.userId?'var(--orange)':'var(--bg-alt)', border:'2px solid var(--border)', display:'grid', placeItems:'center', fontSize:'.82rem', fontWeight:800, color:u.id===me?.userId?'#fff':'var(--text-muted)', flexShrink:0 }}>
                      {(u.name||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:700, fontSize:'.9rem' }}>{u.name}</span>
                        <span style={{ fontSize:'.7rem', color:'var(--text-muted)', fontFamily:'var(--mono)' }}>@{u.username}</span>
                        <span className={`badge ${getRoleColor(u.role)}`}>{getRoleLabel(u.role)}</span>
                        {u.role === 'admin' && <span className="chip" style={{fontSize:'.65rem'}}>Acceso total</span>}
                      </div>
                      <div style={{ fontSize:'.75rem', color:'var(--text-muted)', marginBottom:4 }}>{u.email}</div>

                      {/* Módulos asignados */}
                      {u.role !== 'admin' && assignedMods.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:4 }}>
                          <span style={{ fontSize:'.68rem', color:'var(--text-muted)' }}>Módulos:</span>
                          {assignedMods.map(m => (
                            <span key={m} style={{ fontSize:'.68rem', padding:'1px 7px', borderRadius:99, background:'var(--orange-light)', color:'var(--orange-dark)', fontWeight:600, border:'1px solid var(--orange-mid)' }}>{m}</span>
                          ))}
                        </div>
                      )}

                      {/* Proyectos asignados */}
                      {assignedProjs.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          <span style={{ fontSize:'.68rem', color:'var(--text-muted)' }}>Proyectos:</span>
                          {assignedProjs.map(p => {
                            const acc = PROJECT_ACCESS[projPerms[p.id]];
                            return (
                              <span key={p.id} style={{ fontSize:'.68rem', padding:'1px 8px', borderRadius:99, background:acc?.color+'15', border:`1px solid ${acc?.color}33`, fontWeight:600, color:acc?.color }}>
                                {p.name} → {acc?.l}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Estado */}
                    <button onClick={()=>u.id!==me?.userId&&toggleActive(u)}
                      style={{ padding:'5px 12px', borderRadius:20, border:'none', background:u.active?'#dcfce7':'#fee2e2', color:u.active?'#15803d':'#b91c1c', fontWeight:700, fontSize:'.78rem', cursor:u.id!==me?.userId?'pointer':'default', fontFamily:'var(--font)', flexShrink:0 }}>
                      {u.active?'✓ Activo':'○ Inactivo'}
                    </button>

                    {/* Acciones */}
                    <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                      {u.role !== 'admin' && (
                        <button className="btn btn-secondary btn-sm" onClick={()=>setPermsModal(u)} title="Módulos y proyectos">🔑 Permisos</button>
                      )}
                      {u.id !== me?.userId && (
                        <button className="btn btn-secondary btn-sm" onClick={()=>setEditModal(u)} title="Cambiar rol">✏️</button>
                      )}
                      {u.id !== me?.userId && (
                        <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(u)} title="Eliminar">🗑️</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="empty card" style={{padding:40}}><p>Sin usuarios</p></div>}
          </div>
        )}

        {/* Leyenda de acceso */}
        <div className="card" style={{ marginTop:20, padding:'14px 20px' }}>
          <div style={{ fontSize:'.78rem', fontWeight:700, marginBottom:10, color:'var(--text-muted)' }}>REGLAS DE VISIBILIDAD DE MÓDULOS</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8, fontSize:'.78rem' }}>
            {[
              { rol:'Administrador', color:'var(--danger)', txt:'Ve todos los módulos siempre' },
              { rol:'Auditor',       color:'var(--success)', txt:'Ve Auditoría siempre + lo que el admin asigne' },
              { rol:'Líder / Analista / Viewer', color:'var(--info)', txt:'Solo los módulos que el admin asigne' },
            ].map(r => (
              <div key={r.rol} style={{ padding:'10px 12px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'var(--surface-warm)' }}>
                <div style={{ fontWeight:700, color:r.color, marginBottom:3, fontSize:'.75rem' }}>{r.rol}</div>
                <div style={{ color:'var(--text-muted)' }}>{r.txt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal crear */}
      {createModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setCreateModal(false)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Nuevo usuario</span><button className="btn btn-ghost btn-icon" onClick={()=>setCreateModal(false)}>✕</button></div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {error && <div className="alert alert-error mb-4">{error}</div>}
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Nombre *</label><input className="form-control" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required /></div>
                  <div className="form-group"><label className="form-label">Usuario *</label><input className="form-control" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value.toLowerCase().replace(/\s/g,'')}))} required /></div>
                </div>
                <div className="form-group"><label className="form-label">Correo *</label><input className="form-control" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required /></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Contraseña *</label><input className="form-control" type="password" placeholder="Mín. 8 caracteres" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} required minLength={8} /></div>
                  <div className="form-group">
                    <label className="form-label">Rol</label>
                    <select className="form-control" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                      {Object.entries(ROLES).map(([k,r])=><option key={k} value={k}>{r.l}</option>)}
                    </select>
                  </div>
                </div>
                {form.role && ROLES[form.role] && (
                  <div className="alert alert-info">
                    <div><strong>{ROLES[form.role].l}:</strong> {ROLES[form.role].desc}</div>
                    <div style={{marginTop:5,fontSize:'.72rem',color:'var(--text-muted)'}}>
                      Módulos visibles por defecto: <strong>{(DEFAULT_MODULES[form.role]||[]).join(', ') || 'Ninguno'}</strong>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Creando...':'Crear usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar rol */}
      {editModal && <EditRolModal user={editModal} onSave={handleEditRole} onClose={()=>setEditModal(null)} />}

      {/* Modal permisos — módulos + proyectos */}
      {permsModal && <PermsModal user={permsModal} projects={projects} onSave={savePerms} onClose={()=>setPermsModal(null)} />}
    </>
  );
}

function EditRolModal({ user, onSave, onClose }) {
  const [role, setRole] = useState(user.role||'viewer');
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div><span className="modal-title">Cambiar rol — {user.name}</span><div style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:2}}>@{user.username}</div></div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {Object.entries(ROLES).map(([k,r])=>(
              <label key={k} style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'11px 14px', borderRadius:'var(--radius-sm)', border:`1.5px solid ${role===k?'var(--orange)':'var(--border)'}`, background:role===k?'var(--orange-light)':'var(--surface)', transition:'all .15s' }}>
                <input type="radio" name="role" value={k} checked={role===k} onChange={()=>setRole(k)} style={{accentColor:'var(--orange)',marginTop:3,flexShrink:0}} />
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}><span className={`badge ${ROLE_COLORS[k]}`}>{r.l}</span></div>
                  <div style={{fontSize:'.75rem',color:'var(--text-muted)'}}>{r.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={()=>onSave(user.id,role)} disabled={role===user.role}>Guardar rol</button>
        </div>
      </div>
    </div>
  );
}

function PermsModal({ user, projects, onSave, onClose }) {
  const rawPerms = user.projectPerms || {};

  // Estado inicial: módulos (desde _mod_ prefijos)
  const initMods = {};
  ASSIGNABLE_MODULES.forEach(m => {
    initMods[m.key] = rawPerms['_mod_'+m.key] === true;
  });

  // Estado inicial: proyectos
  const initProj = extractProjectPerms(rawPerms);

  const [modPerms, setModPerms] = useState(initMods);
  const [projPerms, setProjPerms] = useState(initProj);

  const toggleMod = key => setModPerms(p => ({ ...p, [key]: !p[key] }));
  const setAccess = (pid, level) => setProjPerms(p => ({ ...p, [pid]: level }));

  const handleSave = () => {
    // Combinar módulos (con prefijo) + proyectos en un solo objeto
    const combined = { ...projPerms };
    Object.entries(modPerms).forEach(([k, v]) => {
      combined['_mod_'+k] = v;
    });
    onSave(user.id, combined);
  };

  // Módulos que el auditor siempre tiene (no editables)
  const isAuditor = user.role === 'auditor';

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <span className="modal-title">Permisos — {user.name}</span>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
              <span className={`badge ${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span>
              <span style={{fontSize:'.72rem',color:'var(--text-muted)'}}>@{user.username}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* ── Sección 1: Módulos visibles ── */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:'.78rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text-muted)', marginBottom:10 }}>
              Módulos visibles en el menú
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {ASSIGNABLE_MODULES.map(m => {
                const isFixed = isAuditor && m.key === 'logs'; // auditor siempre ve logs
                const checked = isFixed || modPerms[m.key];
                return (
                  <label key={m.key} style={{ display:'flex', alignItems:'center', gap:10, cursor:isFixed?'default':'pointer', padding:'10px 14px', borderRadius:'var(--radius-sm)', border:`1.5px solid ${checked?'var(--orange)':'var(--border)'}`, background:checked?'var(--orange-light)':'var(--surface)', opacity:isFixed?.7:1, transition:'all .15s' }}>
                    <input type="checkbox" checked={checked} disabled={isFixed} onChange={()=>!isFixed&&toggleMod(m.key)} style={{accentColor:'var(--orange)',width:15,height:15,flexShrink:0}} />
                    <div>
                      <div style={{fontSize:'.85rem',fontWeight:600}}>{m.l}</div>
                      {isFixed && <div style={{fontSize:'.68rem',color:'var(--text-muted)'}}>Siempre visible para Auditor</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="divider" />

          {/* ── Sección 2: Acceso a proyectos ── */}
          <div>
            <div style={{ fontSize:'.78rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text-muted)', marginBottom:10 }}>
              Nivel de acceso por proyecto
            </div>
            {projects.length === 0 ? (
              <p style={{color:'var(--text-muted)',fontSize:'.83rem'}}>No hay proyectos disponibles.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {projects.map(p => {
                  const current = projPerms[p.id] || 'none';
                  const acc = PROJECT_ACCESS[current];
                  return (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:'var(--radius-sm)', border:`1.5px solid ${current!=='none'?acc?.color+'55':'var(--border)'}`, background:current!=='none'?acc?.color+'08':'var(--surface)' }}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:'.87rem'}}>{p.name}</div>
                        {p.responsible&&<div style={{fontSize:'.7rem',color:'var(--text-muted)'}}>{p.responsible}</div>}
                      </div>
                      <select value={current} onChange={e=>setAccess(p.id,e.target.value)}
                        style={{ padding:'6px 12px', borderRadius:'var(--radius-sm)', border:`1.5px solid ${acc?.color||'var(--border)'}`, background:'var(--surface)', color:acc?.color||'var(--text)', fontWeight:700, fontSize:'.8rem', cursor:'pointer', fontFamily:'var(--font)', outline:'none', minWidth:180 }}>
                        {Object.entries(PROJECT_ACCESS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.l}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Guardar permisos</button>
        </div>
      </div>
    </div>
  );
}
