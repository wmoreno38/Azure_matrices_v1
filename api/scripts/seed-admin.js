/**
 * Script para crear el primer usuario administrador
 * Ejecutar UNA SOLA VEZ después de crear la BD:
 *
 *   PG_HOST=... PG_DATABASE=... PG_USER=... PG_PASSWORD=... node scripts/seed-admin.js
 */

import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const ADMIN = {
  username: 'admin',
  name:     'Administrador',
  email:    'admin@tuorganizacion.com',   // ← cambia esto
  password: 'CambiaEstaPassword123!',     // ← cambia esto
  role:     'admin',
};

async function main() {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash(ADMIN.password, 12);
    await client.query(
      `INSERT INTO users (username, name, email, password_hash, role, active, project_perms)
       VALUES ($1, $2, $3, $4, 'admin', true, '{}')
       ON CONFLICT (email) DO NOTHING`,
      [ADMIN.username, ADMIN.name, ADMIN.email, hash]
    );
    console.log('✅ Usuario admin creado:', ADMIN.email);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
