import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

const PAGE_TITLES = {
  '/dashboard': 'Panel',
  '/projects':  'Proyectos',
  '/reports':   'Informes',
  '/archive':   'Archivo',
  '/logs':      'Auditoría',
  '/users':     'Usuarios',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Cierra sidebar al cambiar de ruta en móvil
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const pageTitle = Object.entries(PAGE_TITLES).find(([k]) => location.pathname.startsWith(k))?.[1] || '';

  return (
    <div className="app-shell">
      {/* Overlay en móvil */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(45,42,38,.55)',
            zIndex: 99,
            backdropFilter: 'blur(2px)',
            animation: 'fadeIn .15s ease',
          }}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        {/* Header móvil con hamburguesa */}
        <div className="mobile-header">
          <button
            className="hamburger"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Menú"
          >
            <span /><span /><span />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <path d="M24 4L44 24L24 44L4 24L24 4Z" fill="#E87722" opacity=".3"/>
              <path d="M24 12L36 24L24 36L12 24L24 12Z" fill="#E87722"/>
            </svg>
            <span style={{ fontWeight: 800, fontSize: '.92rem', color: 'var(--text)' }}>
              {pageTitle || 'Línea 1.5'}
            </span>
          </div>
          <div style={{ width: 40 }} /> {/* spacer */}
        </div>

        <Outlet />
      </main>
    </div>
  );
}
