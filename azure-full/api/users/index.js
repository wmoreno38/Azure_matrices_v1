import bcrypt from 'bcryptjs';
import { query, queryOne } from '../lib/db.js';
import { requireAdmin, handleOptions, jsonResponse } from '../lib/auth.js';

function mapUser(u) {
  return {
    id: u.id, username: u.username, name: u.name, email: u.email,
    role: u.role, active: u.active, createdAt: u.created_at,
    projectPerms: u.project_perms || {},
    failedAttempts: u.failed_attempts, lockedUntil: u.locked_until
  };
}

export default async function handler(context, req) {
  if (handleOptions(req, context)) return;

  const user = await requireAdmin(req, context);
  if (!user) return;

  const id = req.params.id;

  // GET: listar usuarios
  if (req.method === 'GET' && !id) {
    const rows = await query('SELECT * FROM users ORDER BY created_at');
    return jsonResponse(context, rows.map(mapUser));
  }

  // POST: crear usuario
  if (req.method === 'POST') {
    const { email, password, username, name, role } = req.body || {};
    if (!email || !password || !username || !name)
      return jsonResponse(context, 400, { error: 'Todos los campos son requeridos' });
    if (password.length < 8)
      return jsonResponse(context, 400, { error: 'Contraseña debe tener al menos 8 caracteres' });

    // Verificar que email y username no existan
    const existing = await queryOne(
      'SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]
    );
    if (existing) return jsonResponse(context, 400, { error: 'El email o username ya existe' });

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await query(
      `INSERT INTO users (username, name, email, password_hash, role, active, project_perms)
       VALUES ($1,$2,$3,$4,$5,true,'{}') RETURNING id`,
      [username, name, email, passwordHash, role || 'viewer']
    );

    await query(
      `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
       VALUES ('USER_CREATE','Usuarios',$1,$2,$3)`,
      [user.name, user.id, `Usuario creado: ${name} (@${username}) - Rol: ${role || 'viewer'}`]
    );

    return jsonResponse(context, { userId: newUser[0].id, success: true });
  }

  // PUT: actualizar usuario
  if (req.method === 'PUT' && id) {
    const { action, active, role, name, email, project_perms, password } = req.body || {};

    // Activar / desactivar
    if (action === 'toggle') {
      const u = await queryOne('SELECT name, active FROM users WHERE id=$1', [id]);
      const newActive = active !== undefined ? active : !u?.active;
      await query('UPDATE users SET active=$1 WHERE id=$2', [newActive, id]);
      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
         VALUES ('USER_TOGGLE','Usuarios',$1,$2,$3)`,
        [user.name, user.id, `Usuario ${newActive ? 'activado' : 'desactivado'}: ${u?.name || ''}`]
      );
      return jsonResponse(context, { success: true });
    }

    // Actualizar permisos
    if (action === 'update_perms') {
      await query('UPDATE users SET project_perms=$1 WHERE id=$2', [JSON.stringify(project_perms), id]);
      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
         VALUES ('USER_PERMS','Usuarios',$1,$2,$3)`,
        [user.name, user.id, `Permisos actualizados para usuario ID: ${id}`]
      );
      return jsonResponse(context, { success: true });
    }

    // Actualización general
    const fields = [];
    const params = [];
    let   p      = 1;
    if (role)     { fields.push(`role=$${p++}`);  params.push(role); }
    if (name)     { fields.push(`name=$${p++}`);  params.push(name); }
    if (email)    { fields.push(`email=$${p++}`); params.push(email); }
    if (password && password.length >= 8) {
      const hash = await bcrypt.hash(password, 12);
      fields.push(`password_hash=$${p++}`);
      params.push(hash);
    }
    if (project_perms !== undefined) {
      fields.push(`project_perms=$${p++}`);
      params.push(JSON.stringify(project_perms));
    }
    if (fields.length) {
      params.push(id);
      await query(`UPDATE users SET ${fields.join(',')} WHERE id=$${p}`, params);
    }

    return jsonResponse(context, { success: true });
  }

  // DELETE: eliminar usuario
  if (req.method === 'DELETE' && id) {
    const u = await queryOne('SELECT name FROM users WHERE id=$1', [id]);
    await query('DELETE FROM users WHERE id=$1', [id]);
    await query(
      `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
       VALUES ('USER_DELETE','Usuarios',$1,$2,$3)`,
      [user.name, user.id, `Usuario eliminado: ${u?.name || id}`]
    );
    return jsonResponse(context, { success: true });
  }

  return jsonResponse(context, 405, { error: 'Method not allowed' });
}
