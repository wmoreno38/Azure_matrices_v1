import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, canSeeModule } from '../contexts/AuthContext.jsx';

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p}/>) : <path d={d}/>}
  </svg>
);

const ALL_NAV = [
  { to:'/dashboard', label:'Panel',      module:'dashboard', icon:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { to:'/projects',  label:'Proyectos',  module:'projects',  icon:'M3 7h18M3 12h18M3 17h18' },
  { to:'/reports',   label:'Informes',   module:'reports',   icon:'M18 20V10M12 20V4M6 20v-6' },
  { to:'/archive',   label:'Archivo',    module:'archive',   icon:'M21 8v13H3V8M1 3h22v5H1zM10 12h4' },
];

const ALL_ADMIN = [
  { to:'/logs',  label:'Auditoría', module:'logs',  icon:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { to:'/users', label:'Usuarios',  module:'users', icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const initials = (user?.name || user?.username || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const roleLabel = {
    admin: 'Administrador', lider: 'Líder Técnico',
    analista: 'Analista', auditor: 'Auditor', viewer: 'Solo lectura',
  }[user?.role] || user?.role;

  // Filtrar nav items según permisos del usuario
  const visibleNav   = ALL_NAV.filter(item => canSeeModule(user, item.module));
  const visibleAdmin = ALL_ADMIN.filter(item => canSeeModule(user, item.module));

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <h1>
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none" style={{flexShrink:0}}>
            <path d="M24 4L44 24L24 44L4 24L24 4Z" fill="white" opacity=".25"/>
            <path d="M24 12L36 24L24 36L12 24L24 12Z" fill="#fff"/>
          </svg>
          Línea 1.5
        </h1>
        <span>Gestión de Riesgos TI</span>
      </div>

      {/* Navegación filtrada */}
      <nav className="sidebar-nav">
        {visibleNav.length > 0 && (
          <div className="nav-section">
            <div className="nav-label">Menú principal</div>
            {visibleNav.map(item => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onClose}>
                <Icon d={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </div>
        )}

        {visibleAdmin.length > 0 && (
          <div className="nav-section">
            <div className="nav-label">Administración</div>
            {visibleAdmin.map(item => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onClose}>
                <Icon d={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Footer usuario */}
      <div className="sidebar-footer">
        <div className="user-badge">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name || user?.username}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm btn-logout w-full" onClick={handleLogout}
          style={{ color:'rgba(255,255,255,.55)', justifyContent:'center', marginTop:4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
