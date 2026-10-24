const fs = require('node:fs');
const { Pool } = require('pg');

function createPool() {
  if (!process.env.DATABASE_URL) throw new Error('Chưa có DATABASE_URL trong .env.');
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL phải là chuỗi kết nối PostgreSQL.');
  const expected = process.env.SUPABASE_PROJECT_REF;
  if (expected && url.hostname !== `db.${expected}.supabase.co` && decodeURIComponent(url.username) !== `postgres.${expected}`) {
    throw new Error('DATABASE_URL không khớp dự án SUPABASE_PROJECT_REF.');
  }
  // Keep certificate verification enabled even if a pasted URL contains sslmode=require.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(key);
  const ssl = { rejectUnauthorized: true };
  if (process.env.DATABASE_SSL_CA_FILE) ssl.ca = fs.readFileSync(process.env.DATABASE_SSL_CA_FILE, 'utf8');
  const pool = new Pool({ connectionString: url.href, ssl, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
  pool.on('error', () => console.error('Kết nối nền tới cơ sở dữ liệu bị gián đoạn.'));
  return pool;
}

module.exports = { createPool };
