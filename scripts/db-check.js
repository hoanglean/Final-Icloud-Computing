require('../src/config/env').loadEnv();
const { createPool } = require('../src/db');

async function check() {
  const pool = createPool();
  try {
    const { rows } = await pool.query("SELECT c.relname AS table_name, c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname");
    const accounts = await pool.query('SELECT role, count(*)::integer AS count FROM public.users GROUP BY role ORDER BY role');
    console.log(JSON.stringify({ connected: true, project: process.env.SUPABASE_PROJECT_REF, tables: rows, accounts: accounts.rows }, null, 2));
  } finally { await pool.end(); }
}

check().catch(error => { console.error(`Kiểm tra kết nối thất bại (${error.code || 'ERROR'}).`); process.exitCode = 1; });
