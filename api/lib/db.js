import pg from 'pg';

const { Pool } = pg;

// Pool de conexiones a Azure Database for PostgreSQL
const pool = new Pool({
  host:     process.env.PG_HOST,      // e.g. linea15.postgres.database.azure.com
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,  // e.g. linea15
  user:     process.env.PG_USER,      // e.g. adminuser
  password: process.env.PG_PASSWORD,
  ssl: { rejectUnauthorized: false }, // requerido por Azure PostgreSQL
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Helper: ejecutar query con parámetros
export async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// Helper: obtener un solo registro
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Helper: insert y retornar fila insertada
export async function insert(sql, params = []) {
  const rows = await query(sql + ' RETURNING *', params);
  return rows[0];
}

export default pool;
