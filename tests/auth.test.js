const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/services/password');
const { sessions } = require('../src/services/session');

test('PostgreSQL authentication and permissions', async () => {
  const db = new PGlite();
  let server;
  let base;
  async function start() {
    server = await createApp({ pool: {
      async query(sql, values) {
        const result = await db.query(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows };
      },
      async end() {}
    } });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { if (server?.listening) await new Promise(resolve => server.close(resolve)); sessions.clear(); }
  function client() {
    let cookie='';
    return async (route, form) => {
      const response = await fetch(base+route,{redirect:'manual',headers:{cookie,...(form?{'content-type':'application/x-www-form-urlencoded'}:{})},...(form?{method:'POST',body:new URLSearchParams(form)}:{})});
      if(response.headers.has('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
      const text=await response.text();
      return {status:response.status,location:response.headers.get('location'),text,csrf:text.match(/name="csrf" value="([a-f0-9]+)"/)?.[1]};
    };
  }
  try {
    await db.exec(fs.readFileSync(path.join(__dirname, '../database/migrations/001_inventory_pricing.sql'), 'utf8'));
    const passwordHash = await hashPassword('Initial@123');
    for (const role of ['admin', 'staff']) await db.query('INSERT INTO users(name,email,role,password_hash) VALUES ($1,$2,$3,$4)', [role, `${role}@test.invalid`, role, passwordHash]);
    base = await start();
    let staff=client(), admin=client(), other=client();
    assert.equal((await staff('/admin')).location,'/login');
    let page=await staff('/login'); assert.equal(page.status,200); assert.ok(!page.text.includes('Tài khoản dùng thử')); assert.ok(!page.text.includes('Mật khẩu ban đầu'));
    assert.equal((await staff('/login',{email:'staff@test.invalid',password:'Initial@123'})).status,403);
    assert.equal((await staff('/login',{csrf:page.csrf,email:'staff@test.invalid',password:'wrong'})).status,401);
    assert.equal((await staff('/login',{csrf:page.csrf,email:'staff@test.invalid',password:'Initial@123',role:'admin'})).location,'/staff');
    assert.equal((await staff('/admin')).status,403);
    assert.equal((await staff('/staff')).status,200);
    page=await admin('/login');
    assert.equal((await admin('/login',{csrf:page.csrf,email:'admin@test.invalid',password:'Initial@123'})).location,'/admin');
    assert.equal((await admin('/admin')).status,200);
    assert.equal((await admin('/staff')).status,200);
    page=await other('/login');
    await other('/login',{csrf:page.csrf,email:'staff@test.invalid',password:'Initial@123'});
    page=await staff('/change-password');
    const change=(currentPassword,newPassword,confirmPassword=newPassword)=>staff('/change-password',{csrf:page.csrf,currentPassword,newPassword,confirmPassword});
    assert.equal((await change('bad','Changed@456')).status,400);
    assert.equal((await change('Initial@123','short')).status,400);
    assert.equal((await change('Initial@123','Changed@456','Different@123')).status,400);
    assert.equal((await change('Initial@123','Initial@123')).status,400);
    assert.equal((await change('Initial@123','Changed@456')).location,'/login?changed=1');
    assert.equal((await other('/staff')).location,'/login');
    page=await staff('/login');
    assert.equal((await staff('/login',{csrf:page.csrf,email:'staff@test.invalid',password:'Initial@123'})).status,401);
    assert.equal((await staff('/login',{csrf:page.csrf,email:'staff@test.invalid',password:'Changed@456'})).location,'/staff');
    page=await staff('/staff');
    assert.equal((await staff('/logout',{csrf:page.csrf})).location,'/login');
    assert.equal((await staff('/staff')).location,'/login');
    const saved=JSON.stringify((await db.query('SELECT password_hash FROM users')).rows);
    assert.ok(!saved.includes('Changed@456'));assert.ok(!saved.includes('Initial@123'));
    await stop(); base=await start(); staff=client();
    page=await staff('/login');
    assert.equal((await staff('/login',{csrf:page.csrf,email:'staff@test.invalid',password:'Changed@456'})).location,'/staff');
    const attacker=client();page=await attacker('/login');
    for(let i=0;i<10;i++) assert.equal((await attacker('/login',{csrf:page.csrf,email:'nobody@local.test',password:'wrong'})).status,401);
    assert.equal((await attacker('/login',{csrf:page.csrf,email:'nobody@local.test',password:'wrong'})).status,429);
  } finally { await stop(); await db.close(); }
});

test('database configuration and availability are required without local fallback', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try { await assert.rejects(createApp(), /DATABASE_URL/); }
  finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
  let closed = false;
  await assert.rejects(createApp({ pool: {
    async query() { throw new Error('Database unavailable'); },
    async end() { closed = true; }
  } }), /Database unavailable/);
  assert.equal(closed, true);
});
