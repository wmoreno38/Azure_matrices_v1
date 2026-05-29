import { app } from '@azure/functions';
import bcrypt    from 'bcryptjs';
import nodemailer from 'nodemailer';
import { query, queryOne } from '../lib/db.js';
import {
  signToken, requireAuth,
  jsonOk, json400, json401, json403, json404, json423, json500, optionsOk,
} from '../lib/auth.js';

app.http('auth', {
  methods:   ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route:     'auth/{action}',
  handler:   authHandler,
});

async function authHandler(req, context) {
  if (req.method === 'OPTIONS') return optionsOk();

  const action = context.triggerMetadata?.routeParams?.action
    || req.params?.action
    || new URL(req.url).pathname.split('/').pop();

  try {
    // ── POST /api/auth/login ────────────────────────────────
    if (req.method === 'POST' && action === 'login') {
      const body = await req.json().catch(() => ({}));
      const { email, password } = body;
      if (!email || !password) return json400('Email y contraseña requeridos');

      const user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);

      if (user?.locked_until && new Date(user.locked_until) > new Date())
        return json423('Cuenta bloqueada temporalmente. Intenta en 15 minutos.');

      const passwordOk = user && await bcrypt.compare(password, user.password_hash);

      if (!user || !passwordOk) {
        if (user) {
          const attempts = (user.failed_attempts || 0) + 1;
          const locked   = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
          await query('UPDATE users SET failed_attempts=$1, locked_until=$2 WHERE id=$3',
            [attempts, locked, user.id]);
          if (locked) return json423('Cuenta bloqueada por 15 minutos por múltiples intentos fallidos');
          const remaining = 5 - attempts;
          return json401('Credenciales incorrectas' +
            (remaining > 0 && remaining < 3 ? ` (${remaining} intentos restantes)` : ''));
        }
        return json401('Credenciales incorrectas');
      }

      if (!user.active) return json403('Cuenta desactivada');

      await query('UPDATE users SET failed_attempts=0, locked_until=NULL WHERE id=$1', [user.id]);

      const token = signToken({
        userId:   user.id,
        role:     user.role,
        name:     user.name,
        username: user.username,
        email:    user.email,
        project_perms: user.project_perms || {},
      });

      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
         VALUES ('LOGIN','Acceso',$1,$2,$3)`,
        [user.name, user.id, `Inicio de sesión: ${user.name} (${user.role})`]
      );

      return jsonOk({
        token,
        user: {
          userId:      user.id,
          username:    user.username,
          name:        user.name,
          email:       user.email,
          role:        user.role,
          loginAt:     new Date().toISOString(),
          projectPerms: user.project_perms || {},
        },
      });
    }

    // ── POST /api/auth/logout ───────────────────────────────
    if (req.method === 'POST' && action === 'logout') {
      const { user, error } = requireAuth(req);
      if (error) return error;
      await query(
        `INSERT INTO audit_logs (type,category,user_name,user_id,detail)
         VALUES ('LOGOUT','Acceso',$1,$2,$3)`,
        [user.name, user.id, `Cierre de sesión: ${user.name}`]
      );
      return jsonOk({ success: true });
    }

    // ── GET /api/auth/me ────────────────────────────────────
    if (req.method === 'GET' && action === 'me') {
      const { user, error } = requireAuth(req);
      if (error) return error;
      return jsonOk({
        userId:      user.id,
        username:    user.username,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        projectPerms: user.project_perms || {},
      });
    }

    // ── POST /api/auth/recovery ─────────────────────────────
    if (req.method === 'POST' && action === 'recovery') {
      const body = await req.json().catch(() => ({}));
      const { email } = body;
      if (!email) return json400('Email requerido');

      const user = await queryOne('SELECT id, name FROM users WHERE email=$1', [email]);
      if (user) {
        const resetToken = signToken({ userId: user.id, purpose: 'reset' });
        const resetUrl   = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });
          await transporter.sendMail({
            from:    process.env.SMTP_FROM || 'noreply@linea15.com',
            to:      email,
            subject: 'Recuperación de contraseña — Línea 1.5',
            html:    `<p>Hola ${user.name},</p>
                      <p>Haz clic en el enlace para restablecer tu contraseña (válido 1 hora):</p>
                      <p><a href="${resetUrl}">${resetUrl}</a></p>`,
          });
        } catch (e) {
          console.error('Error enviando correo:', e.message);
        }
      }
      return jsonOk({ success: true, message: 'Si el email existe, se enviará un enlace.' });
    }

    return json404('Ruta no encontrada');

  } catch (err) {
    context.error('auth error:', err);
    return json500(err.message);
  }
}
