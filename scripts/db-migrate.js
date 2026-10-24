require('../src/config/env').loadEnv();
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createPool } = require('../src/db');

async function migrate() {
  const pool = createPool();
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(73692104)');
    await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    await client.query('ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY');
    for (const role of ['anon', 'authenticated']) {
      const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
      if (exists.rowCount) await client.query(`REVOKE ALL ON TABLE public.schema_migrations FROM ${role}`);
    }
    const dir = path.join(__dirname, '../database/migrations');
    const applied = [];
    for (const file of fs.readdirSync(dir).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const existing = await client.query('SELECT checksum FROM public.schema_migrations WHERE version = $1', [file]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Migration đã áp dụng bị thay đổi: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations(version, checksum) VALUES ($1, $2)', [file, checksum]);
      applied.push(file);
    }
    await client.query('COMMIT');
    console.log(applied.length ? `Đã áp dụng: ${applied.join(', ')}` : 'Cơ sở dữ liệu đã cập nhật; không cần chạy lại migration.');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error(`Migration thất bại (${error.code || 'ERROR'}): ${error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[ẩn kết nối]')}`);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

migrate().catch(() => { console.error('Không thể khởi tạo kết nối. Kiểm tra .env.'); process.exitCode = 1; });
