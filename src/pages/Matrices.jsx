import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { DEFAULT_CONTROLS } from '../data/defaultControls.js';

/* ── Storage key ── */
const STORAGE_KEY = 'l15_matrices_v1';

function loadMatrices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Versión base por defecto
  return [{
    id: 'v1',
    name: 'Matriz SII&CB v1.0',
    description: 'Versión base — 33 controles SFC/SARO',
    createdAt: new Date().toISOString(),
    active: true,
    controls: DEFAULT_CONTROLS.map((c,i) => ({ ...c, id: c.code, order: i+1 })),
  }];
}

function saveMatrices(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getActiveControls() {
  const matrices = loadMatrices();
  const active = matrices.find(m => m.active);
  return active ? active.controls : DEFAULT_CONTROLS.map((c,i) => ({...c, id:c.code, order:i+1}));
}

/* ── Campo de texto expandible para el editor ── */
function FieldRow({ label, value, onChange, multiline = false, rows = 3 }) {
  return (
    <div className="form-group" style={{marginBottom:10}}>
      <label className="form-label" style={{fontSize:'.72rem',textTransform:'uppercase',letterSpacing:'.4px'}}>{label}</label>
      {multiline
        ? <textarea className="form-control" rows={rows} value={value||''} onChange={e=>onChange(e.target.value)} style={{fontSize:'.8rem',lineHeight:1.4}}/>
        : <input className="form-control" value={value||''} onChange={e=>onChange(e.target.value)} style={{fontSize:'.8rem'}}/>}
    </div>
  );
}

/* ── Editor de un control ── */
function ControlEditor({ ctrl, onSave, onClose }) {
  const [form, setForm] = useState({ ...ctrl, normatividad: { ...ctrl.normatividad } });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setNorm = (k,v) => setForm(f=>({...f,normatividad:{...f.normatividad,[k]:v}}));

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg" style={{maxHeight:'88vh',display:'flex',flexDirection:'column'}}>
        <div className="modal-header">
          <span className="modal-title">
            {ctrl.code ? <>Editar — <span style={{color:'var(--orange)',fontFamily:'var(--mono)'}}>{ctrl.code}</span></> : 'Nuevo control'}
          </span>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{overflowY:'auto',flex:1}}>
          <div className="grid-2">
            <FieldRow label="Código" value={form.code} onChange={v=>set('code',v)}/>
            <div className="form-group" style={{marginBottom:10}}>
              <label className="form-label" style={{fontSize:'.72rem',textTransform:'uppercase',letterSpacing:'.4px'}}>Riesgo Inherente (RI)</label>
              <select className="form-control" style={{fontSize:'.8rem'}} value={form.riNiv||'Extremo'} onChange={e=>set('riNiv',e.target.value)}>
                {['Extremo','Alto','Medio','Bajo'].map(v=><option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <FieldRow label="Causa base" value={form.causaBase} onChange={v=>set('causaBase',v)}/>
            <div className="form-group" style={{marginBottom:10}}>
              <label className="form-label" style={{fontSize:'.72rem',textTransform:'uppercase',letterSpacing:'.4px'}}>Riesgo Residual (RR)</label>
              <select className="form-control" style={{fontSize:'.8rem'}} value={form.rrNiv||'Bajo'} onChange={e=>set('rrNiv',e.target.value)}>
                {['Extremo','Alto','Medio','Bajo'].map(v=><option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <FieldRow label="Causas asociadas" value={form.causasAsociadas} onChange={v=>set('causasAsociadas',v)} multiline rows={3}/>
          <FieldRow label="Control base" value={form.controlBase} onChange={v=>set('controlBase',v)} multiline rows={5}/>
          <div style={{borderTop:'1px solid var(--border)',paddingTop:14,marginTop:6}}>
            <div style={{fontWeight:700,fontSize:'.8rem',marginBottom:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.5px'}}>⚖️ Normatividad</div>
            <FieldRow label="ISO 27001" value={form.normatividad?.iso27001} onChange={v=>setNorm('iso27001',v)} multiline rows={2}/>
            <FieldRow label="ISO 27002" value={form.normatividad?.iso27002} onChange={v=>setNorm('iso27002',v)} multiline rows={2}/>
            <FieldRow label="Circular SFC 029" value={form.normatividad?.circular} onChange={v=>setNorm('circular',v)} multiline rows={2}/>
            <FieldRow label="Circular SFC 005 / Nube" value={form.normatividad?.sfc} onChange={v=>setNorm('sfc',v)} multiline rows={2}/>
            <FieldRow label="Otras normas" value={form.normatividad?.otras} onChange={v=>setNorm('otras',v)} multiline rows={2}/>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={()=>onSave(form)}>Guardar control</button>
        </div>
      </div>
    </div>
  );
}

/* ── Formulario nueva versión ── */
function NewVersionModal({ onSave, onClose, existing }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [base, setBase] = useState(existing[0]?.id || '');

  const handleSave = () => {
    if (!name.trim()) { alert('Ingresa un nombre para la versión.'); return; }
    const baseMatrix = existing.find(m=>m.id===base);
    const newControls = baseMatrix
      ? JSON.parse(JSON.stringify(baseMatrix.controls))
      : DEFAULT_CONTROLS.map((c,i)=>({...c,id:c.code,order:i+1}));
    onSave({ name: name.trim(), description: desc.trim(), controls: newControls });
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Nueva versión de matriz</span><button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="form-group"><label className="form-label">Nombre de la versión *</label><input className="form-control" placeholder="Ej: Matriz SII&CB v2.0" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-control" rows={2} placeholder="Describe los cambios principales…" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
          <div className="form-group">
            <label className="form-label">Clonar controles desde</label>
            <select className="form-control" value={base} onChange={e=>setBase(e.target.value)}>
              {existing.map(m=><option key={m.id} value={m.id}>{m.name} ({m.controls.length} controles)</option>)}
              <option value="">Matriz base original (33 controles)</option>
            </select>
          </div>
          <div className="alert alert-warning" style={{fontSize:'.8rem',marginTop:8}}>Los controles se clonan como punto de partida. Podrás editarlos libremente antes de activarla.</div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Crear versión</button>
        </div>
      </div>
    </div>
  );
}

/* ── Página principal ── */
export default function Matrices() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [matrices, setMatrices] = useState(loadMatrices);
  const [selected, setSelected] = useState(() => loadMatrices().find(m=>m.active)?.id || 'v1');
  const [editCtrl, setEditCtrl] = useState(null); // null | ctrl object (new if !ctrl.code)
  const [newVerModal, setNewVerModal] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const persist = data => { setMatrices(data); saveMatrices(data); };

  const currentMatrix = matrices.find(m=>m.id===selected) || matrices[0];
  const filteredControls = (currentMatrix?.controls||[]).filter(c => {
    const q = search.toLowerCase();
    return !q || c.code?.toLowerCase().includes(q) || c.causaBase?.toLowerCase().includes(q) || c.controlBase?.toLowerCase().includes(q);
  });

  const handleActivate = id => {
    persist(matrices.map(m=>({...m, active: m.id===id})));
  };

  const handleSaveControl = (updatedCtrl) => {
    const updated = matrices.map(m => {
      if (m.id !== selected) return m;
      const exists = m.controls.find(c=>c.id===updatedCtrl.id||c.code===updatedCtrl.code);
      let controls;
      if (exists) {
        controls = m.controls.map(c=>(c.id===updatedCtrl.id||c.code===updatedCtrl.code)?{...updatedCtrl,id:updatedCtrl.code}:c);
      } else {
        const newId = updatedCtrl.code || `CT-${String(m.controls.length+1).padStart(3,'0')}`;
        controls = [...m.controls, {...updatedCtrl, id:newId, code:newId, order:m.controls.length+1}];
      }
      return {...m, controls};
    });
    persist(updated);
    setEditCtrl(null);
  };

  const handleDeleteControl = id => {
    persist(matrices.map(m=>m.id!==selected?m:{...m,controls:m.controls.filter(c=>c.id!==id)}));
    setDeleteConfirm(null);
  };

  const handleNewVersion = ({ name, description, controls }) => {
    const newId = 'v' + Date.now();
    persist([...matrices, { id:newId, name, description, createdAt:new Date().toISOString(), active:false, controls }]);
    setSelected(newId);
    setNewVerModal(false);
  };

  const handleDeleteVersion = id => {
    if (matrices.find(m=>m.id===id)?.active) { alert('No puedes eliminar la versión activa.'); return; }
    const updated = matrices.filter(m=>m.id!==id);
    persist(updated);
    setSelected(updated[0]?.id);
  };

  const RISK_COLORS = { Extremo:'badge-red', Alto:'badge-red', Medio:'badge-yellow', Bajo:'badge-green' };

  return (
    <>
      <div className="page-header">
        <div style={{flex:1}}><h2>Matrices de Controles</h2><div className="subtitle">Gestiona versiones de la matriz base y edita controles — solo administrador</div></div>
        {isAdmin && <button type="button" className="btn btn-primary" onClick={()=>setNewVerModal(true)}>+ Nueva versión</button>}
      </div>
      <div className="page-body">

        {/* Selector de versiones */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>
          {matrices.map(m=>(
            <div key={m.id} onClick={()=>setSelected(m.id)}
              style={{padding:'12px 16px',borderRadius:'var(--radius)',border:`2px solid ${selected===m.id?'var(--orange)':'var(--border)'}`,background:selected===m.id?'var(--orange-light)':'var(--surface)',cursor:'pointer',minWidth:200,flex:'0 0 auto',boxShadow:'var(--shadow)',transition:'all .15s'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <span style={{fontWeight:700,fontSize:'.88rem',color:selected===m.id?'var(--orange)':'var(--text)'}}>{m.name}</span>
                {m.active && <span className="badge badge-green" style={{fontSize:'.65rem'}}>✓ Activa</span>}
              </div>
              <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginBottom:6}}>{m.description||'Sin descripción'}</div>
              <div style={{fontSize:'.7rem',color:'var(--text-light)'}}>{m.controls.length} controles · {new Date(m.createdAt).toLocaleDateString('es-CO')}</div>
            </div>
          ))}
        </div>

        {/* Acciones de la versión seleccionada */}
        {currentMatrix && isAdmin && (
          <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
            <div style={{flex:1,fontWeight:700,fontSize:'.9rem'}}>
              {currentMatrix.name}
              {currentMatrix.active && <span className="badge badge-green" style={{marginLeft:8,fontSize:'.68rem'}}>✓ Versión activa</span>}
            </div>
            {!currentMatrix.active && (
              <button type="button" className="btn btn-primary btn-sm" onClick={()=>handleActivate(currentMatrix.id)}>
                ✓ Activar esta versión
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setEditCtrl({code:'',causaBase:'',causasAsociadas:'',controlBase:'',riNiv:'Extremo',rrNiv:'Bajo',normatividad:{iso27001:'',iso27002:'',circular:'',sfc:'',otras:''}})}>
              + Agregar control
            </button>
            {matrices.length > 1 && !currentMatrix.active && (
              <button type="button" className="btn btn-danger btn-sm" onClick={()=>handleDeleteVersion(currentMatrix.id)}>
                🗑 Eliminar versión
              </button>
            )}
          </div>
        )}

        {/* Buscador */}
        <div className="toolbar" style={{marginBottom:12}}>
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input className="form-control" placeholder="Buscar controles…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <span style={{fontSize:'.75rem',color:'var(--text-muted)',marginLeft:'auto'}}>{filteredControls.length}/{currentMatrix?.controls?.length||0} controles</span>
        </div>

        {/* Tabla de controles */}
        <div className="table-wrap card">
          <table style={{tableLayout:'fixed',width:'100%'}}>
            <colgroup>
              <col style={{width:82}}/><col style={{width:'18%'}}/><col style={{width:'32%'}}/>
              <col style={{width:72}}/><col style={{width:72}}/><col style={{width:120}}/>
            </colgroup>
            <thead>
              <tr><th>Código</th><th>Causa base</th><th>Control base</th><th>RI</th><th>RR</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filteredControls.map(c=>(
                <tr key={c.id||c.code} style={{verticalAlign:'top'}}>
                  <td style={{paddingTop:14}}><span className="chip" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--orange)'}}>{c.code}</span></td>
                  <td><div style={{fontWeight:600,fontSize:'.8rem',marginTop:10}}>{c.causaBase}</div></td>
                  <td>
                    <div style={{fontSize:'.78rem',lineHeight:1.4,marginTop:10,whiteSpace:'pre-line'}}>
                      {c.controlBase?.length>160 ? c.controlBase.slice(0,160)+'…' : c.controlBase}
                    </div>
                  </td>
                  <td style={{paddingTop:14}}><span className={`badge ${RISK_COLORS[c.riNiv]||'badge-gray'}`}>{c.riNiv}</span></td>
                  <td style={{paddingTop:14}}><span className={`badge ${RISK_COLORS[c.rrNiv]||'badge-gray'}`}>{c.rrNiv}</span></td>
                  <td style={{paddingTop:12}}>
                    {isAdmin && (
                      <div style={{display:'flex',flexDirection:'column',gap:4}}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setEditCtrl(c)}>✏ Editar</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={()=>setDeleteConfirm(c)}>🗑 Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredControls.length===0 && <tr><td colSpan={6}><div className="empty"><p>Sin controles con este filtro</p></div></td></tr>}
            </tbody>
          </table>
        </div>

        {/* Aviso versión activa */}
        {currentMatrix?.active && (
          <div className="alert alert-warning" style={{marginTop:14,fontSize:'.8rem'}}>
            ⚠️ Estás viendo la <strong>versión activa</strong>. Los cambios que hagas aquí afectarán los nuevos proyectos que se creen.
            Los proyectos existentes conservan sus controles guardados.
          </div>
        )}
      </div>

      {editCtrl && isAdmin && (
        <ControlEditor
          ctrl={editCtrl}
          onSave={handleSaveControl}
          onClose={()=>setEditCtrl(null)}
        />
      )}

      {newVerModal && isAdmin && (
        <NewVersionModal
          existing={matrices}
          onSave={handleNewVersion}
          onClose={()=>setNewVerModal(false)}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDeleteConfirm(null)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Eliminar control</span><button type="button" className="btn btn-ghost btn-icon" onClick={()=>setDeleteConfirm(null)}>✕</button></div>
            <div className="modal-body">
              <p>¿Eliminar el control <strong style={{color:'var(--orange)',fontFamily:'var(--mono)'}}>{deleteConfirm.code}</strong>?</p>
              <p style={{fontSize:'.83rem',color:'var(--text-muted)',marginTop:8}}>Esta acción no se puede deshacer. Los proyectos existentes no se verán afectados.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={()=>setDeleteConfirm(null)}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={()=>handleDeleteControl(deleteConfirm.id||deleteConfirm.code)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
