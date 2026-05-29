import { app }   from '@azure/functions';
import bcrypt     from 'bcryptjs';
import { query, queryOne } from '../lib/db.js';
import { requireAdmin, jsonOk, json400, json405, json500, optionsOk } from '../lib/auth.js';

function mapUser(u) {
  return {
    id:             u.id,
    username:       u.username,
    name:           u.name,
    email:          u.email,
    role:           u.role,
    active:         u.active,
    createdAt:      u.created_at,
    projectPerms:   u.project_perms || {},
    failedAttempts: u.failed_attempts,
    lockedUntil:    u.locked_until,
  };
}

app.http('users', {
  methods:   ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route:     'users/{id?}',
  handler:   usersHandler,
});

async function usersHandler(req, context) {
  if (req.method === 'OPTIONS') return optionsOk();

  const { user, error } = requireAdmin(req);
  if (error) return error;

  const id = context.triggerMetadata?.routeParams?.id || req.params?.id;

  try {
    // GET /api/users
    if (req.method === 'GET' && !id) {
      const rows = await query('SELECT * FROM users ORDER BY created_at');
      return jsonOk(rows.map(mapUser));
    }

    // POST /api/users — crear usuario
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { email, password, username, name, role } = body;
      if (!email || !password || !username || !name)
        return json400('Todos los campos son requeridos');
      if (password.length < 8)
        return json400('Contraseña debe tener al menos 8 caracteres');

      const existing = await queryOne(
        'SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]
      );
      if (existing) return json400('El email o username ya existe');

      const passwordHash = await bcrypt.hash(password, 12);
      const newUser = await query(
        `INSERT INTO users (username, name, email, password_hash, role, active, project_perms)
         VALUES ($1,$2,$3,$4,$5,true,'{}') RETURNING id`,
        [username, name, email, passwordHash, role || 'viewer']
      );

      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
         VALUES ('USER_CREATE','Usuarios',$1,$2,$3)`,
        [user.name, user.id,
         `Usuario creado: ${name} (@${username}) - Rol: ${role || 'viewer'}`]
      );

      return jsonOk({ userId: newUser[0].id, success: true });
    }

    // PUT /api/users/{id}
    if (req.method === 'PUT' && id) {
      const body = await req.json().catch(() => ({}));
      const { action, active, role, name, email, project_perms, password } = body;

      if (action === 'toggle') {
        const u = await queryOne('SELECT name, active FROM users WHERE id=$1', [id]);
        const newActive = active !== undefined ? active : !u?.active;
        await query('UPDATE users SET active=$1 WHERE id=$2', [newActive, id]);
        await query(
          `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
           VALUES ('USER_TOGGLE','Usuarios',$1,$2,$3)`,
          [user.name, user.id,
           `Usuario ${newActive ? 'activado' : 'desactivado'}: ${u?.name || ''}`]
        );
        return jsonOk({ success: true });
      }

      if (action === 'update_perms') {
        await query(
          'UPDATE users SET project_perms=$1 WHERE id=$2',
          [JSON.stringify(project_perms), id]
        );
        await query(
          `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
           VALUES ('USER_PERMS','Usuarios',$1,$2,$3)`,
          [user.name, user.id, `Permisos actualizados para usuario ID: ${id}`]
        );
        return jsonOk({ success: true });
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
        fields.push(`password_hash=$${p++}`); params.push(hash);
      }
      if (project_perms !== undefined) {
        fields.push(`project_perms=$${p++}`);
        params.push(JSON.stringify(project_perms));
      }
      if (fields.length) {
        params.push(id);
        await query(`UPDATE users SET ${fields.join(',')} WHERE id=$${p}`, params);
      }

      return jsonOk({ success: true });
    }

    // DELETE /api/users/{id}
    if (req.method === 'DELETE' && id) {
      const u = await queryOne('SELECT name FROM users WHERE id=$1', [id]);
      await query('DELETE FROM users WHERE id=$1', [id]);
      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
         VALUES ('USER_DELETE','Usuarios',$1,$2,$3)`,
        [user.name, user.id, `Usuario eliminado: ${u?.name || id}`]
      );
      return jsonOk({ success: true });
    }

    return json405();

  } catch (err) {
    context.error('users error:', err);
    return json500(err.message);
  }
}
