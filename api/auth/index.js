import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { query, queryOne } from '../lib/db.js';
import { signToken, requireAuth, handleOptions, jsonResponse } from '../lib/auth.js';

export default async function handler(context, req) {
  if (handleOptions(req, context)) return;

  const action = req.params.action || '';

  // ── POST /api/auth/login ────────────────────────────────────
  if (req.method === 'POST' && action === 'login') {
    const { email, password } = req.body || {};
    if (!email || !password)
      return jsonResponse(context, 400, { error: 'Email y contraseña requeridos' });

    const user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);

    // Cuenta bloqueada
    if (user?.locked_until && new Date(user.locked_until) > new Date()) {
      return jsonResponse(context, 423, { error: 'Cuenta bloqueada temporalmente. Intenta en 15 minutos.' });
    }

    const passwordOk = user && await bcrypt.compare(password, user.password_hash);

    if (!user || !passwordOk) {
      if (user) {
        const attempts = (user.failed_attempts || 0) + 1;
        const locked   = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await query(
          'UPDATE users SET failed_attempts=$1, locked_until=$2 WHERE id=$3',
          [attempts, locked, user.id]
        );
        if (locked) return jsonResponse(context, 423, { error: 'Cuenta bloqueada por 15 minutos por múltiples intentos fallidos' });
        const remaining = 5 - attempts;
        return jsonResponse(context, 401, {
          error: 'Credenciales incorrectas' + (remaining > 0 && remaining < 3 ? ` (${remaining} intentos restantes)` : '')
        });
      }
      return jsonResponse(context, 401, { error: 'Credenciales incorrectas' });
    }

    if (!user.active) return jsonResponse(context, 403, { error: 'Cuenta desactivada' });

    // Limpiar intentos fallidos
    await query('UPDATE users SET failed_attempts=0, locked_until=NULL WHERE id=$1', [user.id]);

    const token = signToken({ 
  userId: user.id, 
  role: user.role,
  name: user.name,
  username: user.username,
  email: user.email
});

    await query(
      `INSERT INTO audit_logs (type, category, user_name, user_id, detail)
       VALUES ('LOGIN','Acceso',$1,$2,$3)`,
      [user.name, user.id, `Inicio de sesión: ${user.name} (${user.role})`]
    );

    return jsonResponse(context, {
      token,
      user: {
        userId: user.id, username: user.username,
        name: user.name, email: user.email,
        role: user.role, loginAt: new Date().toISOString(),
        projectPerms: user.project_perms || {}
      }
    });
  }

  // ── POST /api/auth/logout ───────────────────────────────────
  if (req.method === 'POST' && action === 'logout') {
    const user = await requireAuth(req, context);
    if (!user) return;
    await query(
      `INSERT INTO audit_logs (type, category, user_name, user_id, detail)
       VALUES ('LOGOUT','Acceso',$1,$2,$3)`,
      [user.name, user.id, `Cierre de sesión: ${user.name}`]
    );
    return jsonResponse(context, { success: true });
  }

  // ── GET /api/auth/me ────────────────────────────────────────
  if (req.method === 'GET' && action === 'me') {
    const user = await requireAuth(req, context);
    if (!user) return;
    return jsonResponse(context, {
      userId: user.id, username: user.username,
      name: user.name, email: user.email,
      role: user.role, projectPerms: user.project_perms || {}
    });
  }

  // ── POST /api/auth/recovery ─────────────────────────────────
  if (req.method === 'POST' && action === 'recovery') {
    const { email } = req.body || {};
    if (!email) return jsonResponse(context, 400, { error: 'Email requerido' });

    const user = await queryOne('SELECT id, name FROM users WHERE email=$1', [email]);

    // Siempre responder OK para no revelar si el email existe
    if (user) {
      // Token de recuperación válido 1 hora
      const resetToken = signToken({ userId: user.id, purpose: 'reset' });
      const resetUrl   = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      // Enviar correo via SMTP (configura tus variables SMTP_*)
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@linea15.com',
          to: email,
          subject: 'Recuperación de contraseña — Línea 1.5',
          html: `<p>Hola ${user.name},</p>
                 <p>Haz clic en el siguiente enlace para restablecer tu contraseña (válido 1 hora):</p>
                 <p><a href="${resetUrl}">${resetUrl}</a></p>`
        });
      } catch (e) {
        console.error('Error enviando correo:', e.message);
      }
    }

    return jsonResponse(context, { success: true, message: `Si el email existe, se enviará un enlace de recuperación.` });
  }

  return jsonResponse(context, 404, { error: 'Ruta no encontrada' });
}
