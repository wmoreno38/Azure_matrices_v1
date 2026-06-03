import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { auth } from '../api/client.js';

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/>
    </svg>
  );
}

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [recEmail, setRecEmail] = useState('');
  const [recMsg, setRecMsg]     = useState('');
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(email, password); navigate('/dashboard'); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRecovery = async (e) => {
    e.preventDefault(); setLoading(true); setRecMsg('');
    try { await auth.recovery(recEmail); setRecMsg('Enlace de recuperación enviado. Revisa tu correo.'); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-brand-logo">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L44 24L24 44L4 24L24 4Z" fill="white" opacity=".9"/>
            <path d="M24 12L36 24L24 36L12 24L24 12Z" fill="#E87722"/>
          </svg>
        </div>
        <h1>Línea 1.5</h1>
        <p className="tagline">Gestión de Riesgos Tecnológicos</p>
        <div style={{ width: 40, height: 3, background: 'var(--orange)', borderRadius: 99, margin: '22px 0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 260 }}>
          {[
            { icon: '🛡️', text: '33 controles SARO / SFC' },
            { icon: '📎', text: 'Evidencias con archivos' },
            { icon: '📊', text: 'Dashboard y reportes' },
            { icon: '⚖️', text: 'Apalancamiento jurídico' },
            { icon: '🎙️', text: 'Dictado por voz' },
            { icon: '📥', text: 'Exportar Excel + evidencias' },
          ].map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,.6)', fontSize: '.8rem' }}>
              <span style={{ fontSize: '1rem' }}>{f.icon}</span>{f.text}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: '.65rem', color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: 1 }}>Desarrollado para</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)' }} />
            <span style={{ color: 'rgba(255,255,255,.5)', fontSize: '.78rem', fontWeight: 600 }}>Porvenir S.A.</span>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)' }} />
          </div>
          <div style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.2)' }}>Fondo de Pensiones y Cesantías · Grupo Aval</div>
        </div>
      </div>

      <div className="login-form-wrap">
        <div className="login-form">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 36, height: 36, background: 'var(--orange)', borderRadius: 10, display: 'grid', placeItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                <path d="M24 4L44 24L24 44L4 24L24 4Z" fill="white" opacity=".9"/>
                <path d="M24 14L34 24L24 34L14 24L24 14Z" fill="#E87722"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--text)' }}>Línea 1.5</div>
              <div style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>Porvenir · Riesgos TI</div>
            </div>
          </div>

          {!recovery ? (
            <>
              <h2>Bienvenida</h2>
              <p className="lead">Ingresa tus credenciales para continuar</p>
              {error && <div className="alert alert-error mb-4">{error}</div>}
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Correo electrónico</label>
                  <input className="form-control" type="email" placeholder="usuario@porvenir.com.co"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-control"
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{ paddingRight: 42 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      title={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        color: showPass ? 'var(--orange)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', borderRadius: 4,
                        transition: 'color .15s',
                      }}
                    >
                      <EyeIcon open={showPass} />
                    </button>
                  </div>
                </div>
                <button className="btn btn-primary w-full" type="submit" disabled={loading}
                  style={{ marginTop: 8, padding: '11px 16px', fontSize: '.9rem', justifyContent: 'center' }}>
                  {loading
                    ? <><svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Ingresando...</>
                    : 'Ingresar'}
                </button>
              </form>
              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRecovery(true); setError(''); }}
                  style={{ color: 'var(--orange)', fontSize: '.8rem' }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Recuperar acceso</h2>
              <p className="lead">Te enviaremos un enlace a tu correo corporativo</p>
              {error  && <div className="alert alert-error   mb-4">{error}</div>}
              {recMsg && <div className="alert alert-success mb-4">{recMsg}</div>}
              <form onSubmit={handleRecovery}>
                <div className="form-group">
                  <label className="form-label">Correo electrónico</label>
                  <input className="form-control" type="email" placeholder="usuario@porvenir.com.co"
                    value={recEmail} onChange={e => setRecEmail(e.target.value)} required />
                </div>
                <button className="btn btn-primary w-full" type="submit" disabled={loading}
                  style={{ marginTop: 8, padding: '11px 16px', justifyContent: 'center' }}>
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>
              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRecovery(false); setError(''); setRecMsg(''); }}
                  style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>
                  ← Volver al inicio de sesión
                </button>
              </div>
            </>
          )}

          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--text-light)', lineHeight: 1.6 }}>
              Vigilado por la Superintendencia Financiera de Colombia<br/>
              © 2025 Porvenir S.A. · Grupo Aval
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
