import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { users as usersApi } from '../api/client.js';

export default function Profile() {
  const { user, login } = useAuth();
  const [tab, setTab] = useState('info');
  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
  });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {type:'success'|'error', text}

  const flash = (type, text) => { setMsg({type,text}); setTimeout(()=>setMsg(null), 3500); };

  const handleSaveInfo = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await usersApi.update(user.userId || user.id, { name: form.name, username: form.username, email: form.email });
      flash('success', 'Perfil actualizado correctamente.');
    } catch(err) { flash('error', err.message); }
    finally { setSaving(false); }
  };

  const handleSavePwd = async e => {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) { flash('error', 'Las contraseñas nuevas no coinciden.'); return; }
    if (pwd.next.length < 8) { flash('error', 'La contraseña debe tener al menos 8 caracteres.'); return; }
    setSaving(true);
    try {
      await usersApi.update(user.userId || user.id, { currentPassword: pwd.current, newPassword: pwd.next });
      setPwd({ current:'', next:'', confirm:'' });
      flash('success', 'Contraseña actualizada correctamente.');
    } catch(err) { flash('error', err.message); }
    finally { setSaving(false); }
  };

  const initials = (user?.name || user?.username || 'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const roleLabel = { admin:'Administrador', lider:'Líder Técnico', analista:'Analista', auditor:'Auditor', viewer:'Solo lectura' }[user?.role] || user?.role;
  const roleColor = { admin:'badge-red', lider:'badge-orange', analista:'badge-blue', auditor:'badge-green', viewer:'badge-gray' }[user?.role] || 'badge-gray';

  const EyeBtn = ({ field }) => (
    <button type="button" onClick={()=>setShowPwd(p=>({...p,[field]:!p[field]}))}
      style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:4,color:showPwd[field]?'var(--orange)':'var(--text-muted)',display:'flex',alignItems:'center',borderRadius:4}}>
      {showPwd[field]
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/></svg>}
    </button>
  );

  return (
    <>
      <div className="page-header">
        <div style={{flex:1}}><h2>Mi Perfil</h2><div className="subtitle">Gestiona tu información personal y credenciales</div></div>
      </div>
      <div className="page-body" style={{maxWidth:620}}>
        {/* Avatar card */}
        <div className="card" style={{padding:'24px',display:'flex',alignItems:'center',gap:20,marginBottom:20}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:'var(--orange)',display:'grid',placeItems:'center',fontSize:'1.4rem',fontWeight:800,color:'#fff',flexShrink:0}}>{initials}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:'1.1rem'}}>{user?.name || user?.username}</div>
            <div style={{color:'var(--text-muted)',fontSize:'.83rem',marginTop:2}}>{user?.email}</div>
            <div style={{marginTop:6}}><span className={`badge ${roleColor}`}>{roleLabel}</span></div>
          </div>
        </div>

        {/* Flash message */}
        {msg && <div className={`alert alert-${msg.type==='success'?'success':'error'} mb-4`} style={{marginBottom:16}}>{msg.text}</div>}

        {/* Tabs */}
        <div className="tabs" style={{marginBottom:16}}>
          {[{k:'info',l:'Información'},{k:'password',l:'Contraseña'}].map(t=>(
            <button type="button" key={t.k} className={`tab ${tab===t.k?'active':''}`} onClick={()=>setTab(t.k)}>{t.l}</button>
          ))}
        </div>

        {tab==='info' && (
          <div className="card" style={{padding:24}}>
            <form onSubmit={handleSaveInfo}>
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input className="form-control" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="Nombre completo"/>
              </div>
              <div className="form-group">
                <label className="form-label">Usuario (@)</label>
                <input className="form-control" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} required placeholder="nombre_usuario"/>
              </div>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input className="form-control" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required placeholder="correo@porvenir.com.co"/>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Guardando…':'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        )}

        {tab==='password' && (
          <div className="card" style={{padding:24}}>
            <form onSubmit={handleSavePwd}>
              {[
                {field:'current',label:'Contraseña actual'},
                {field:'next',label:'Nueva contraseña'},
                {field:'confirm',label:'Confirmar nueva contraseña'},
              ].map(({field,label})=>(
                <div className="form-group" key={field}>
                  <label className="form-label">{label}</label>
                  <div style={{position:'relative'}}>
                    <input className="form-control" type={showPwd[field]?'text':'password'} value={pwd[field]} onChange={e=>setPwd(p=>({...p,[field]:e.target.value}))} required style={{paddingRight:42}}/>
                    <EyeBtn field={field}/>
                  </div>
                </div>
              ))}
              <div style={{fontSize:'.75rem',color:'var(--text-muted)',marginBottom:12}}>Mínimo 8 caracteres.</div>
              <div style={{display:'flex',justifyContent:'flex-end'}}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Guardando…':'Cambiar contraseña'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
