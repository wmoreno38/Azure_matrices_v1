import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projects as projectsApi, controls as controlsApi, evidences as evidencesApi } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { exportMatriz } from '../utils/exportMatriz.js';
import { ROLES, ROLE_COLORS, PROJECT_ACCESS } from './Users.jsx';

function getProjectAccess(role, projectPerms, projectId) {
  if (role === 'admin') return 'full';
  return (projectPerms || {})[projectId] || 'none';
}
function canDoByAccess(access, action) {
  if (access === 'none') return false;
  if (access === 'full') return true;
  if (access === 'fill') return action === 'fill_controls';
  if (access === 'evidence') return action === 'add_evidence' || action === 'approve_evidence';
  if (access === 'view') return false;
  return false;
}

const RISK_COLORS = { Extremo:'badge-red', Alto:'badge-red', Medio:'badge-yellow', Bajo:'badge-green' };
const EV_LABEL = { aprobada:'Aprobada', rechazada:'Rechazada', en_revision:'En revisión' };
const EV_COLOR = { aprobada:'badge-green', rechazada:'badge-red', en_revision:'badge-yellow' };

function toBase64(file) {
  return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
}
function useDebounce(v,d) {
  const [deb,setDeb]=useState(v);
  useEffect(()=>{ const t=setTimeout(()=>setDeb(v),d); return ()=>clearTimeout(t); },[v,d]);
  return deb;
}
function validateFinalize(controls, evs) {
  const incomplete=(controls||[]).filter(c=>!c.compliance?.trim()).length;
  if (incomplete>0) return `Faltan ${incomplete} controles por documentar.`;
  if (!evs||evs.length===0) return 'Debes agregar al menos una evidencia.';
  return null;
}

function ComplianceInput({ ctrl, onSave, readOnly }) {
  const [value,setValue]=useState(ctrl.compliance||'');
  const [status,setStatus]=useState('idle');
  const [listening,setListening]=useState(false);
  const recogRef=useRef(null);
  const lastSaved=useRef(ctrl.compliance||'');
  const debounced=useDebounce(value,1500);
  useEffect(()=>{
    if(debounced===lastSaved.current||readOnly)return;
    setStatus('saving');
    onSave(ctrl.id,debounced).then(()=>{ lastSaved.current=debounced; setStatus('saved'); setTimeout(()=>setStatus('idle'),2000); }).catch(()=>setStatus('error'));
  },[debounced]);
  useEffect(()=>{ setValue(ctrl.compliance||''); lastSaved.current=ctrl.compliance||''; },[ctrl.id]);
  const toggleVoice=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR)return alert('Dictado por voz requiere Chrome o Edge.');
    if(listening&&recogRef.current){recogRef.current.stop();setListening(false);return;}
    const r=new SR(); r.lang='es-CO'; r.continuous=true; r.interimResults=true; recogRef.current=r;
    r.onresult=e=>{const t=Array.from(e.results).map(x=>x[0].transcript).join(''); setValue(lastSaved.current+(lastSaved.current&&!lastSaved.current.endsWith(' ')?' ':'')+t);};
    r.onend=()=>setListening(false); r.start(); setListening(true);
  };
  if(readOnly) return <div style={{fontSize:'.78rem',color:ctrl.compliance?'var(--text)':'var(--text-light)',fontStyle:ctrl.compliance?'normal':'italic',whiteSpace:'pre-line'}}>{ctrl.compliance||'Sin documentar'}</div>;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:3}}>
      <div style={{display:'flex',gap:5}}>
        <textarea className="form-control" rows={2} placeholder="Documentar cumplimiento…" value={value} onChange={e=>setValue(e.target.value)} style={{fontSize:'.78rem',flex:1,minHeight:'unset',borderColor:listening?'var(--danger)':undefined}} />
        <button className={`btn btn-sm ${listening?'btn-danger':'btn-secondary'}`} onClick={toggleVoice} style={{flexShrink:0,padding:'6px 8px'}}>
          {listening?<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>}
        </button>
      </div>
      <div style={{height:13,fontSize:'.68rem'}}>
        {status==='saving'&&<span style={{color:'var(--text-muted)'}}>Guardando…</span>}
        {status==='saved'&&<span style={{color:'var(--success)'}}>✓ Guardado</span>}
        {status==='error'&&<span style={{color:'var(--danger)'}}>✗ Error</span>}
        {listening&&<span style={{color:'var(--danger)',fontWeight:600}}>🔴 Escuchando…</span>}
      </div>
    </div>
  );
}

function NormBox({ norm }) {
  const [open,setOpen]=useState(false);
  if(!norm)return null;
  const secs=[{k:'iso27001',l:'ISO 27001',c:'#5B21B6',bg:'rgba(91,33,182,.08)'},{k:'iso27002',l:'ISO 27002',c:'#1A7AB5',bg:'rgba(26,122,181,.08)'},{k:'circular',l:'Circular SFC',c:'#B45309',bg:'rgba(180,83,9,.08)'},{k:'sfc',l:'Req. Nube SFC',c:'#166534',bg:'rgba(22,101,52,.08)'},{k:'otras',l:'Otras normas',c:'#B91C1C',bg:'rgba(185,28,28,.08)'}];
  const valid=secs.filter(s=>norm[s.k]?.trim()&&!norm[s.k].startsWith('Validar')&&norm[s.k]!=='Aplica');
  if(!valid.length)return null;
  return (
    <div style={{marginTop:8}}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:6,width:'100%',padding:'6px 10px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',cursor:'pointer',color:'var(--text-muted)',fontSize:'.7rem',fontWeight:700,fontFamily:'var(--font)',textTransform:'uppercase',letterSpacing:'.5px'}}>
        <span style={{transition:'transform .2s',transform:open?'rotate(90deg)':'none',fontSize:'.65rem'}}>▶</span>
        ⚖️ Normatividad ({valid.length})
        {valid.map(s=><span key={s.k} style={{width:6,height:6,borderRadius:'50%',background:s.c,flexShrink:0}}/>)}
      </button>
      {open&&<div style={{display:'flex',flexDirection:'column',gap:4,marginTop:4}}>{valid.map(s=><div key={s.k} style={{background:s.bg,borderRadius:'var(--radius-sm)',padding:'6px 10px',border:`1px solid ${s.c}33`}}><div style={{fontSize:'.65rem',fontWeight:700,color:s.c,marginBottom:2}}>{s.l}</div><div style={{fontSize:'.7rem',color:'var(--text)',whiteSpace:'pre-line',lineHeight:1.4}}>{norm[s.k]}</div></div>)}</div>}
    </div>
  );
}

function EvidenceViewer({ ev, ctrl, canApprove, canDelete, userName, onUpdate, onDelete }) {
  const [open,setOpen]=useState(false);
  const [localStatus,setLocalStatus]=useState(ev.status);
  const handleStatus=async s=>{setLocalStatus(s);await onUpdate(ev.id,{status:s,reviewer:userName}).catch(e=>alert(e.message));};
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',cursor:'pointer',background:'var(--bg)'}}>
        <span style={{fontFamily:'var(--mono)',fontSize:'.75rem',color:'var(--orange)',fontWeight:700}}>{ctrl?.code||'—'}</span>
        <span className={`badge ${EV_COLOR[localStatus]||'badge-gray'}`}>{EV_LABEL[localStatus]}</span>
        <span className="badge badge-blue" style={{fontSize:'.68rem'}}>{ev.type}</span>
        <span style={{flex:1,fontSize:'.83rem',fontWeight:500}}>{ev.description}</span>
        {ev.date&&<span style={{fontSize:'.7rem',color:'var(--text-muted)',fontFamily:'var(--mono)'}}>{new Date(ev.date).toLocaleDateString('es-CO')}</span>}
        {(ev.files||[]).length>0&&<span style={{fontSize:'.7rem',color:'var(--text-muted)'}}>📎{ev.files.length}</span>}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transform:open?'rotate(180deg)':'none',transition:'.2s',flexShrink:0}}><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open&&(
        <div style={{padding:14,borderTop:'1px solid var(--border)'}}>
          {ev.notes&&<p style={{fontSize:'.82rem',marginBottom:12,color:'var(--text-muted)'}}><strong style={{color:'var(--text)'}}>Notas:</strong> {ev.notes}</p>}
          {(ev.files||[]).length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:'.72rem',fontWeight:700,color:'var(--text-muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.5px'}}>Archivos adjuntos</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {ev.files.map(f=>{const isImg=f.type?.startsWith('image/'),isPdf=f.type==='application/pdf';return(
                  <div key={f.id} style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',overflow:'hidden'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'var(--bg)'}}><span>{isImg?'🖼️':isPdf?'📄':'📎'}</span><span style={{flex:1,fontSize:'.8rem',fontWeight:500}}>{f.name}</span>{f.size&&<span style={{fontSize:'.7rem',color:'var(--text-muted)',fontFamily:'var(--mono)'}}>{(f.size/1024).toFixed(1)} KB</span>}<a href={f.data} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Abrir ↗</a></div>
                    {isImg&&f.data&&<img src={f.data} alt={f.name} style={{width:'100%',maxHeight:320,objectFit:'contain',background:'#111',display:'block'}}/>}
                    {isPdf&&f.data&&<iframe src={f.data} title={f.name} style={{width:'100%',height:420,border:'none',display:'block'}}/>}
                  </div>
                );})}
              </div>
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:10,borderTop:'1px solid var(--border)',flexWrap:'wrap'}}>
            {ev.reviewer&&<span style={{fontSize:'.78rem',color:'var(--text-muted)'}}>Revisor: <strong>{ev.reviewer}</strong></span>}
            <div style={{flex:1}}/>
            {canApprove&&<><button className={`btn btn-sm ${localStatus==='aprobada'?'btn-primary':'btn-secondary'}`} onClick={()=>handleStatus('aprobada')}>✓ Aprobar</button><button className={`btn btn-sm ${localStatus==='rechazada'?'btn-danger':'btn-secondary'}`} onClick={()=>handleStatus('rechazada')}>✗ Rechazar</button><button className="btn btn-ghost btn-sm" onClick={()=>handleStatus('en_revision')}>↩ En revisión</button></>}
            {canDelete&&<button className="btn btn-danger btn-sm" onClick={()=>onDelete(ev.id)}>Eliminar</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ pct, color='var(--orange)' }) {
  return <div style={{height:8,background:'var(--border)',borderRadius:99,overflow:'hidden',margin:'8px 0 4px'}}><div style={{height:'100%',width:pct+'%',background:color,borderRadius:99,transition:'width .6s ease'}}/></div>;
}

function ProjectOverview({ project, onNavigate, onExport, exporting, canFinalize, finalizeError, onFinalize }) {
  const controls=project.controls||[], evs=project.evidences||[];
  const tc=controls.length, wc=controls.filter(c=>c.compliance?.trim()).length;
  const te=evs.length, eApproved=evs.filter(e=>e.status==='aprobada').length;
  const ctrlWithEv=controls.filter(c=>evs.some(e=>e.controlId===c.id)).length;
  const ctrlFull=controls.filter(c=>c.compliance?.trim()&&evs.some(e=>e.controlId===c.id&&e.status==='aprobada')).length;
  const pctCtrl=tc?Math.round((wc/tc)*100):0, pctCoverage=tc?Math.round((ctrlWithEv/tc)*100):0;
  const pctEvApp=te?Math.round((eApproved/te)*100):0, pctFull=tc?Math.round((ctrlFull/tc)*100):0;
  const pctTotal=Math.round((pctCtrl+pctCoverage+pctFull)/3);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
        {[{l:'CONTROLES',v:tc},{l:'RESPONDIDOS',v:`${wc}/${tc}`,c:pctCtrl>=100?'var(--success)':'var(--orange)'},{l:'EVIDENCIAS',v:te},{l:'APROBADAS',v:`${eApproved}/${te}`,c:te&&eApproved===te?'var(--success)':'var(--info)'}].map((k,i)=>(
          <div key={i} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'18px 20px',boxShadow:'var(--shadow)'}}>
            <div style={{fontSize:'.68rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:6}}>{k.l}</div>
            <div style={{fontSize:'1.8rem',fontWeight:800,letterSpacing:'-1px',color:k.c||'var(--text)'}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'20px',boxShadow:'var(--shadow)'}}>
          <div style={{fontWeight:700,fontSize:'.95rem',marginBottom:14}}>Avance del Proyecto</div>
          {[
            {icon:'📝',l:'Controles respondidos',pct:pctCtrl,sub:`${wc} de ${tc} controles tienen descripción de cumplimiento`,c:pctCtrl>=100?'var(--success)':'var(--orange)'},
            {icon:'📎',l:'Controles con evidencia',pct:pctCoverage,sub:`${ctrlWithEv} de ${tc} controles tienen al menos una evidencia adjunta`,c:pctCoverage>=100?'var(--success)':'var(--info)'},
            {icon:'✅',l:'Evidencias aprobadas',pct:pctEvApp,sub:`${eApproved} aprobadas · ${evs.filter(e=>e.status==='en_revision').length} en revisión · ${evs.filter(e=>e.status==='rechazada').length} rechazadas`,c:pctEvApp>=100?'var(--success)':'var(--warning)'},
            {icon:'🏆',l:'Controles 100% completados',pct:pctFull,sub:`${ctrlFull} de ${tc} con cumplimiento documentado y evidencia aprobada`,c:pctFull>=100?'var(--success)':'var(--orange)',sm:'(respuesta + evidencia aprobada)'},
          ].map((item,i)=>(
            <div key={i} style={{marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',gap:6,fontSize:'.85rem',fontWeight:600}}><span>{item.icon}</span>{item.l}{item.sm&&<span style={{fontSize:'.7rem',color:'var(--text-muted)',fontWeight:400}}>{item.sm}</span>}</div>
                <span style={{fontWeight:800,color:item.c,fontSize:'.9rem'}}>{item.pct}%</span>
              </div>
              <ProgressBar pct={item.pct} color={item.c}/>
              <div style={{fontSize:'.72rem',color:'var(--text-muted)'}}>{item.sub}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:'var(--orange-light)',border:'2px solid var(--orange)',borderRadius:'var(--radius)',padding:'20px',flex:1,boxShadow:'var(--shadow)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:'1.1rem'}}>📊</span><span style={{fontWeight:800,fontSize:'.95rem'}}>AVANCE TOTAL DE LA MATRIZ</span></div>
              <span style={{fontSize:'1.6rem',fontWeight:800,color:'var(--orange)'}}>{pctTotal}%</span>
            </div>
            <ProgressBar pct={pctTotal} color='var(--orange)'/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:14}}>
              {[{v:pctCtrl,l:'Controles'},{v:pctCoverage,l:'Cobertura Ev.'},{v:pctFull,l:'Completitud'}].map((m,i)=>(
                <div key={i} style={{textAlign:'center',padding:'10px 6px',background:'var(--surface)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:'1.1rem',fontWeight:800,color:m.v>=100?'var(--success)':'var(--orange)'}}>{m.v}%</div>
                  <div style={{fontSize:'.68rem',color:'var(--text-muted)',marginTop:2}}>{m.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {[
              {icon:'📋',l:'Llenar Controles',sub:`${tc-wc} pendientes`,action:'controls',c:'var(--orange)'},
              {icon:'📎',l:'Agregar Evidencias',sub:`${te} registradas`,action:'evidences',c:'var(--info)'},
              {icon:'✅',l:'Aprobar Evidencias',sub:`${evs.filter(e=>e.status==='en_revision').length} por revisar`,action:'approve',c:'var(--success)'},
              {icon:'📥',l:'Exportar Matriz',sub:'Excel + Evidencias',action:'export',c:'#5B21B6'},
            ].map((a,i)=>(
              <button key={i} onClick={()=>a.action==='export'?onExport():onNavigate(a.action==='approve'?'evidences':a.action)} disabled={a.action==='export'&&exporting}
                style={{padding:'14px 10px',borderRadius:'var(--radius)',border:`1px solid ${a.c}33`,background:a.c+'08',cursor:'pointer',textAlign:'center',fontFamily:'var(--font)',transition:'all .15s'}}>
                <div style={{fontSize:'1.4rem',marginBottom:4}}>{a.icon}</div>
                <div style={{fontWeight:700,fontSize:'.82rem',color:a.c}}>{a.action==='export'&&exporting?'Exportando…':a.l}</div>
                <div style={{fontSize:'.7rem',color:'var(--text-muted)',marginTop:2}}>{a.sub}</div>
              </button>
            ))}
          </div>
          {canFinalize&&(
            <button onClick={()=>{if(finalizeError){alert(finalizeError);return;}onFinalize();}}
              style={{padding:'14px',borderRadius:'var(--radius)',border:`2px solid ${finalizeError?'var(--border)':'var(--success)'}`,background:finalizeError?'var(--bg)':'rgba(34,197,94,.08)',cursor:'pointer',textAlign:'center',fontFamily:'var(--font)',opacity:finalizeError?.55:1,transition:'all .15s'}}>
              <div style={{fontSize:'1.3rem',marginBottom:4}}>🏁</div>
              <div style={{fontWeight:700,fontSize:'.85rem',color:finalizeError?'var(--text-muted)':'var(--success)'}}>Finalizar Matriz</div>
              <div style={{fontSize:'.7rem',color:'var(--text-muted)',marginTop:2}}>{finalizeError||'Archivar como registro histórico'}</div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const {id}=useParams(); const navigate=useNavigate();
  const {user}=useAuth();
  const role=user?.role||'viewer';
  const projectAccess=getProjectAccess(role, user?.projectPerms||user?.profile?.project_perms, id);
  const canFill=role==='admin'||canDoByAccess(projectAccess,'fill_controls');
  const canAddEv=role==='admin'||canDoByAccess(projectAccess,'add_evidence');
  const canApprove=role==='admin'||canDoByAccess(projectAccess,'approve_evidence');
  const canDelEv=role==='admin';
  const canFinalize=role==='admin';

  const [project,setProject]=useState(null);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState('overview');
  const [evModal,setEvModal]=useState(null);
  const [evForm,setEvForm]=useState({type:'Documento',description:'',date:'',notes:'',reviewer:'',files:[]});
  const [savingEv,setSavingEv]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [finalModal,setFinalModal]=useState(false);
  const [search,setSearch]=useState('');
  const [filterRisk,setFilterRisk]=useState('');
  const [filterDoc,setFilterDoc]=useState('');
  const [filterEvStatus,setFilterEvStatus]=useState('');

  const load=useCallback(()=>{
    setLoading(true);
    projectsApi.list().then(list=>setProject(list.find(x=>x.id===id)||null)).catch(console.error).finally(()=>setLoading(false));
  },[id]);
  useEffect(load,[load]);

  if(loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Cargando proyecto…</div>;
  if(!project) return <div style={{padding:40,textAlign:'center',color:'var(--danger)'}}>Proyecto no encontrado</div>;

  const controls=project.controls||[], evs=project.evidences||[];
  const filledCount=controls.filter(c=>c.compliance?.trim()).length;
  const pct=controls.length?Math.round((filledCount/controls.length)*100):0;
  const finalizeError=validateFinalize(controls,evs);
  const pendingEvs=evs.filter(e=>e.status==='en_revision').length;

  const filteredControls=controls.filter(c=>{
    const q=search.toLowerCase();
    return(!q||c.code?.toLowerCase().includes(q)||c.causaBase?.toLowerCase().includes(q)||c.controlBase?.toLowerCase().includes(q))&&(!filterRisk||c.riNiv===filterRisk)&&(!filterDoc?true:filterDoc==='doc'?!!c.compliance?.trim():!c.compliance?.trim());
  });
  const filteredEvs=evs.filter(e=>!filterEvStatus||e.status===filterEvStatus);

  const saveCompliance=async(ctrlId,value)=>{
    await controlsApi.updateCompliance(ctrlId,value);
    setProject(p=>({...p,controls:p.controls.map(c=>c.id===ctrlId?{...c,compliance:value}:c)}));
  };
  const handleAddEvidence=async e=>{
    e.preventDefault();setSavingEv(true);
    try{const fd=await Promise.all(evForm.files.map(async f=>({name:f.name,type:f.type,data:await toBase64(f)})));await evidencesApi.create({projectId:id,controlId:evModal.id,...evForm,files:fd});setEvModal(null);setEvForm({type:'Documento',description:'',date:'',notes:'',reviewer:'',files:[]});load();}
    catch(err){alert(err.message);}finally{setSavingEv(false);}
  };
  const handleExport=async()=>{setExporting(true);try{await exportMatriz(project);}catch(e){alert('Error: '+e.message);}finally{setExporting(false);};};
  const handleDeleteEv=async evId=>{if(!confirm('¿Eliminar?'))return;await evidencesApi.delete(evId).catch(e=>alert(e.message));load();};
  const handleUpdateEv=async(evId,data)=>{await evidencesApi.update(evId,data);load();};
  const handleFinalize=async()=>{try{await projectsApi.finalize(id,{finalizedBy:user?.name,finalizedByRole:role,stats:{pct,filledCount,total:controls.length,evidences:evs.length}});navigate('/archive');}catch(e){alert(e.message);}setFinalModal(false);};

  return (
    <>
      <div className="page-header">
        <button className="btn btn-ghost btn-icon" onClick={()=>navigate('/projects')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg></button>
        <div style={{flex:1}}>
          <h2>{project.name}</h2>
          <div className="subtitle">{project.responsible&&<span>{project.responsible} · </span>}{filledCount}/{controls.length} controles · {pct}% avance</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span className={`badge ${ROLE_COLORS[role]||'badge-gray'}`}>{ROLES[role]?.l||role}</span>
          <div className="progress-bar" style={{width:80}}><div className="progress-fill" style={{width:pct+'%',background:pct===100?'var(--success)':'var(--orange)'}}/></div>
          <span style={{fontSize:'.8rem',color:'var(--text-muted)',width:35}}>{pct}%</span>
        </div>
      </div>
      <div className="page-body">
        <div className="tabs">
          {[{k:'overview',l:'Resumen'},{k:'controls',l:`Controles (${controls.length})`},{k:'evidences',l:`Evidencias (${evs.length})${pendingEvs>0?' 🔔':''}`}].map(v=><button key={v.k} className={`tab ${view===v.k?'active':''}`} onClick={()=>setView(v.k)}>{v.l}</button>)}
        </div>

        {view==='overview'&&<ProjectOverview project={project} onNavigate={setView} onExport={handleExport} exporting={exporting} canFinalize={canFinalize} finalizeError={finalizeError} onFinalize={()=>setFinalModal(true)}/>}

        {view==='controls'&&(
          <>
            <div className="toolbar">
              <div className="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><input className="form-control" placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
              <select className="form-control" style={{width:'auto'}} value={filterRisk} onChange={e=>setFilterRisk(e.target.value)}><option value="">Todos los riesgos</option><option>Extremo</option><option>Alto</option><option>Medio</option><option>Bajo</option></select>
              <select className="form-control" style={{width:'auto'}} value={filterDoc} onChange={e=>setFilterDoc(e.target.value)}><option value="">Todos</option><option value="doc">Documentados</option><option value="pen">Pendientes</option></select>
              <span style={{fontSize:'.75rem',color:'var(--text-muted)',marginLeft:'auto'}}>{filteredControls.length}/{controls.length}</span>
            </div>
            <div className="table-wrap card">
              <table>
                <thead><tr><th>Código</th><th>Causa base</th><th>Control base</th><th>RI</th><th>RR</th><th>Cumplimiento {canFill&&<span style={{color:'var(--orange)',fontSize:'.65rem'}}>🎙️</span>}</th><th>Evidencias</th></tr></thead>
                <tbody>
                  {filteredControls.map(c=>{
                    const evc=evs.filter(e=>e.controlId===c.id).length, eap=evs.filter(e=>e.controlId===c.id&&e.status==='aprobada').length;
                    return(<tr key={c.id} style={{background:c.compliance?.trim()?'rgba(34,197,94,.03)':'transparent'}}>
                      <td><span className="chip" style={{fontFamily:'var(--mono)',fontWeight:700,color:'var(--orange)'}}>{c.code}</span></td>
                      <td style={{maxWidth:190}}><div style={{fontSize:'.8rem',fontWeight:600}}>{c.causaBase}</div>{c.causasAsociadas&&<div style={{fontSize:'.7rem',color:'var(--text-muted)',marginTop:2,lineHeight:1.3,whiteSpace:'pre-line'}}>{c.causasAsociadas.substring(0,100)}{c.causasAsociadas.length>100?'…':''}</div>}</td>
                      <td style={{maxWidth:200}}><div style={{fontSize:'.8rem',lineHeight:1.4,whiteSpace:'pre-line'}}>{c.controlBase?.substring(0,140)}{c.controlBase?.length>140?'…':''}</div><NormBox norm={c.normatividad}/></td>
                      <td><span className={`badge ${RISK_COLORS[c.riNiv]||'badge-gray'}`}>{c.riNiv}</span></td>
                      <td><span className={`badge ${RISK_COLORS[c.rrNiv]||'badge-gray'}`}>{c.rrNiv}</span></td>
                      <td style={{minWidth:220}}><ComplianceInput ctrl={c} onSave={saveCompliance} readOnly={!canFill}/></td>
                      <td><div style={{display:'flex',flexDirection:'column',gap:4}}>{canAddEv&&<button className="btn btn-secondary btn-sm" onClick={()=>setEvModal(c)}>+ Evidencia</button>}{evc>0&&<button className="btn btn-ghost btn-sm" style={{fontSize:'.72rem'}} onClick={()=>setView('evidences')}>{eap}/{evc} ✓</button>}</div></td>
                    </tr>);
                  })}
                  {filteredControls.length===0&&<tr><td colSpan={7}><div className="empty"><p>Sin controles con estos filtros</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view==='evidences'&&(
          <>
            <div className="toolbar">
              <select className="form-control" style={{width:'auto'}} value={filterEvStatus} onChange={e=>setFilterEvStatus(e.target.value)}><option value="">Todas</option><option value="en_revision">En revisión</option><option value="aprobada">Aprobadas</option><option value="rechazada">Rechazadas</option></select>
              <div style={{display:'flex',gap:10,fontSize:'.78rem'}}>
                <span style={{color:'var(--success)'}}>✓ {evs.filter(e=>e.status==='aprobada').length}</span>
                <span style={{color:'var(--warning)'}}>◎ {evs.filter(e=>e.status==='en_revision').length}</span>
                <span style={{color:'var(--danger)'}}>✗ {evs.filter(e=>e.status==='rechazada').length}</span>
              </div>
            </div>
            {filteredEvs.length===0?<div className="empty card" style={{padding:60}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p>No hay evidencias{filterEvStatus?' con este estado':'.'}</p></div>
            :<div style={{display:'flex',flexDirection:'column',gap:8}}>{filteredEvs.map(ev=><EvidenceViewer key={ev.id} ev={ev} ctrl={controls.find(c=>c.id===ev.controlId)} canApprove={canApprove} canDelete={canDelEv} userName={user?.name} onUpdate={handleUpdateEv} onDelete={handleDeleteEv}/>)}</div>}
          </>
        )}
      </div>

      {evModal&&canAddEv&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEvModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header"><span className="modal-title">Evidencia — <span style={{color:'var(--orange)',fontFamily:'var(--mono)'}}>{evModal.code}</span></span><button className="btn btn-ghost btn-icon" onClick={()=>setEvModal(null)}>✕</button></div>
            <form onSubmit={handleAddEvidence}>
              <div className="modal-body">
                <div style={{background:'var(--bg)',borderRadius:'var(--radius-sm)',padding:'10px 12px',fontSize:'.78rem',marginBottom:14,whiteSpace:'pre-line'}}><strong>{evModal.controlBase?.substring(0,200)}</strong></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Tipo</label><select className="form-control" value={evForm.type} onChange={e=>setEvForm(f=>({...f,type:e.target.value}))}>{['Captura de pantalla','Documento / Política','Log del sistema','Reporte de auditoría','Acta de reunión','Certificación','Resultado de prueba','Correo electrónico','Otro'].map(t=><option key={t}>{t}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Fecha</label><input className="form-control" type="date" value={evForm.date} onChange={e=>setEvForm(f=>({...f,date:e.target.value}))}/></div>
                </div>
                <div className="form-group"><label className="form-label">Descripción *</label><textarea className="form-control" rows={2} value={evForm.description} onChange={e=>setEvForm(f=>({...f,description:e.target.value}))} required/></div>
                <div className="form-group"><label className="form-label">Notas</label><textarea className="form-control" rows={2} value={evForm.notes} onChange={e=>setEvForm(f=>({...f,notes:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Revisor</label><input className="form-control" value={evForm.reviewer} onChange={e=>setEvForm(f=>({...f,reviewer:e.target.value}))}/></div>
                <div className="form-group">
                  <label className="form-label">Archivos adjuntos</label>
                  <label className="file-drop"><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv" style={{display:'none'}} onChange={e=>setEvForm(f=>({...f,files:Array.from(e.target.files)}))}/>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{margin:'0 auto 8px',display:'block',opacity:.4}}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>Arrastra archivos o haz clic
                  </label>
                  {evForm.files.length>0&&<div className="file-list">{evForm.files.map((f,i)=><div key={i} className="file-item"><span>{f.type?.startsWith('image/')?'🖼️':f.type==='application/pdf'?'📄':'📎'}</span><span className="file-name">{f.name}</span><span className="file-size">{(f.size/1024).toFixed(1)} KB</span></div>)}</div>}
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={()=>setEvModal(null)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={savingEv}>{savingEv?'Guardando…':'Guardar evidencia'}</button></div>
            </form>
          </div>
        </div>
      )}
      {finalModal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setFinalModal(false)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Finalizar matriz</span><button className="btn btn-ghost btn-icon" onClick={()=>setFinalModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="alert alert-warning mb-4">Una vez finalizada, la matriz se archivará y no podrá editarse.</div>
              <div style={{display:'flex',flexDirection:'column',gap:8,fontSize:'.85rem',marginBottom:12}}>
                <div>✅ <strong>{filledCount}/{controls.length}</strong> controles documentados</div>
                <div>✅ <strong>{evs.length}</strong> evidencias ({evs.filter(e=>e.status==='aprobada').length} aprobadas)</div>
              </div>
              <p>¿Confirmas la finalización de <strong>{project.name}</strong>?</p>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setFinalModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={handleFinalize}>Confirmar y archivar</button></div>
          </div>
        </div>
      )}
    </>
  );
}
