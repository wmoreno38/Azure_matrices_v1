import pg from 'pg';

const { Pool } = pg;

// Pool de conexiones — max:1 es clave para Azure Functions (sin servidor persistente)
// Neon serverless requiere ssl y connection_timeout para el wake-up
const pool = new Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl:      { rejectUnauthorized: false },
  max:      1,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 15000,  // 15s para el wake-up de Neon
});

pool.on('error', (err) => {
  console.error('Pool error:', err.message);
});

export async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function insert(sql, params = []) {
  const rows = await query(sql + ' RETURNING *', params);
  return rows[0];
}

export default pool;
