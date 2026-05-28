import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../api/client.js';

const AuthContext = createContext(null);

// Módulos disponibles en la app
export const APP_MODULES = {
  dashboard:  { l: 'Panel',      icon: '◻' },
  projects:   { l: 'Proyectos',  icon: '☰' },
  reports:    { l: 'Informes',   icon: '↑' },
  archive:    { l: 'Archivo',    icon: '▣' },
  logs:       { l: 'Auditoría',  icon: '≡' },
  users:      { l: 'Usuarios',   icon: '⊙', adminOnly: true },
};

// Módulos visibles por defecto según rol (sin configuración del admin)
const DEFAULT_MODULE_ACCESS = {
  admin:    ['dashboard','projects','reports','archive','logs','users'],
  auditor:  ['dashboard','projects','reports','archive','logs'],
  lider:    ['dashboard','projects','reports','archive'],
  analista: ['dashboard','projects'],
  viewer:   ['dashboard','projects'],
};

// Extrae module_perms del project_perms (los guardamos con prefijo _mod_)
function extractModulePerms(projectPerms = {}) {
  const mods = {};
  Object.entries(projectPerms).forEach(([k, v]) => {
    if (k.startsWith('_mod_')) mods[k.replace('_mod_', '')] = v;
  });
  return mods;
}

// Extrae solo los permisos de proyectos (sin _mod_)
export function extractProjectPerms(projectPerms = {}) {
  const perms = {};
  Object.entries(projectPerms).forEach(([k, v]) => {
    if (!k.startsWith('_mod_')) perms[k] = v;
  });
  return perms;
}

// Determina si un usuario puede ver un módulo
export function canSeeModule(user, module) {
  if (!user) return false;
  const role = user.role || 'viewer';

  // Admin siempre ve todo
  if (role === 'admin') return true;

  // Usuarios module solo para admin
  if (module === 'users') return false;

  // Logs: admin y auditor siempre, otros si el admin se lo asignó
  if (module === 'logs') {
    if (role === 'auditor') return true;
    const modPerms = extractModulePerms(user.projectPerms || {});
    return modPerms[module] === true;
  }

  // Si el admin asignó módulos específicos, usar esos
  const modPerms = extractModulePerms(user.projectPerms || {});
  const hasCustomModules = Object.keys(modPerms).length > 0;
  if (hasCustomModules) {
    return modPerms[module] === true;
  }

  // Si no hay configuración, usar defaults por rol
  return (DEFAULT_MODULE_ACCESS[role] || []).includes(module);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('l15_token');
    if (token) {
      auth.me()
        .then(data => setUser(normalizeUser(data)))
        .catch(() => localStorage.removeItem('l15_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await auth.login(email, password);
    localStorage.setItem('l15_token', data.token);
    const normalized = normalizeUser(data.user);
    setUser(normalized);
    return data;
  };

  const logout = async () => {
    await auth.logout().catch(() => {});
    localStorage.removeItem('l15_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Normaliza el usuario para tener projectPerms siempre disponible
function normalizeUser(raw) {
  if (!raw) return null;
  const profile = raw.profile || raw;
  return {
    ...raw,
    userId: raw.userId || raw.id,
    projectPerms: profile.projectPerms || profile.project_perms || {},
  };
}

export function useAuth() {
  return useContext(AuthContext);
}
