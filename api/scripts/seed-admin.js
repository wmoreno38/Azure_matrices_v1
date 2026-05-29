/**
 * Crear el primer usuario administrador.
 * Ejecutar UNA SOLA VEZ después de crear las tablas en Neon:
 *
 *   PG_HOST=ep-xxx.neon.tech PG_DATABASE=neondb PG_USER=neondb_owner \
 *   PG_PASSWORD=xxx node scripts/seed-admin.js
 *
 * O con un archivo .env y dotenv instalado:
 *   node --env-file=.env scripts/seed-admin.js
 */

import bcrypt from 'bcryptjs';
import pg     from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl:      { rejectUnauthorized: false },
});

const ADMIN = {
  username: 'admin',
  name:     'Administrador',
  email:    process.env.ADMIN_EMAIL    || 'admin@linea15.com',
  password: process.env.ADMIN_PASSWORD || 'CambiaEstaPassword123!',
  role:     'admin',
};

async function main() {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash(ADMIN.password, 12);
    const result = await client.query(
      `INSERT INTO users (username, name, email, password_hash, role, active, project_perms)
       VALUES ($1, $2, $3, $4, 'admin', true, '{}')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         active = true
       RETURNING id, email`,
      [ADMIN.username, ADMIN.name, ADMIN.email, hash]
    );
    console.log('✅ Usuario admin listo:', result.rows[0].email);
    console.log('   Email:    ', ADMIN.email);
    console.log('   Password: ', ADMIN.password);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
