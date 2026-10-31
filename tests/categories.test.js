const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applySchema } = require('./helpers/schema');
const { PGlite } = require('@electric-sql/pglite');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/services/password');
const { sessions } = require('../src/services/session');

test('category management through authenticated HTTP and PostgreSQL', async t => {
  const db = new PGlite();
  let server;
  try {
    await applySchema(db);
    const hash = await hashPassword('Testing@123');
    for (const role of ['admin', 'staff']) await db.query('INSERT INTO users(name,email,role,password_hash) VALUES ($1,$2,$3,$4)', [role, `${role}@test.invalid`, role, hash]);
    server = await createApp({ pool: {
      async query(sql, values) {
        const result = await db.query(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows };
      },
      async end() {}
    } });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}`;
    function client() {
      let cookie = '';
      return async (route, form, options = {}) => {
        const response = await fetch(base + route, {
          method: form ? 'POST' : 'GET', redirect: 'manual',
          ...options,
          headers: { cookie, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...options.headers },
          ...(form ? { body: new URLSearchParams(form) } : {})
        });
        if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        const text = await response.text();
        return { status: response.status, location: response.headers.get('location'), allow: response.headers.get('allow'), text, csrf: text.match(/name="csrf" value="([a-f0-9]+)"/)?.[1] };
      };
    }
    const guest = client(), admin = client(), staff = client();
    for (const [request, role] of [[admin, 'admin'], [staff, 'staff']]) {
      const page = await request('/login');
      const login = await request('/login', { csrf: page.csrf, email: `${role}@test.invalid`, password: 'Testing@123' });
      assert.equal(login.status, 303);
    }
    const page = await admin('/categories');
    const csrf = page.csrf;
    const total = async () => (await db.query('SELECT count(*)::integer AS count FROM categories')).rows[0].count;

    await t.test('shows real empty state and blocks guest and staff access', async () => {
      assert.equal(page.status, 200);
      assert.ok(page.text.includes('Chưa có danh mục'));
      assert.ok(!page.text.includes('ĐANG PHÁT TRIỂN'));
      assert.ok(page.text.includes('href="/categories" aria-current="page"'));
      assert.equal((await guest('/categories')).location, '/login');
      assert.equal((await guest('/categories', { name: 'Guest' })).location, '/login');
      const staffPage = await staff('/staff');
      assert.equal((await staff('/categories')).status, 403);
      assert.equal((await staff('/categories', { csrf: staffPage.csrf, name: 'Staff' })).status, 403);
      assert.equal(await total(), 0);
    });

    await t.test('requires CSRF, form encoding, valid names and supported methods', async () => {
      assert.equal((await admin('/categories', { name: 'No token' })).status, 403);
      assert.equal((await admin('/categories', { csrf: 'wrong', name: 'Bad token' })).status, 403);
      assert.equal((await admin('/categories', { csrf, name: '   ' })).status, 400);
      assert.equal((await admin('/categories', { csrf, name: 'x'.repeat(121) })).status, 400);
      assert.equal((await admin('/categories', { csrf, name: 'Bad\u0000name' })).status, 400);
      assert.equal((await admin('/categories', { csrf, name: 'JSON' }, { headers: { 'content-type': 'application/json' } })).status, 415);
      const unsupported = await admin('/categories', undefined, { method: 'DELETE' });
      assert.equal(unsupported.status, 405);
      assert.equal(unsupported.allow, 'GET, POST');
      assert.equal(await total(), 0);
    });

    await t.test('creates trimmed unique names and preserves submitted values on duplicate', async () => {
      const created = await admin('/categories', { csrf, name: '  Beverages  ' });
      assert.equal(created.status, 303);
      assert.equal(created.location, '/categories?saved=created');
      assert.equal((await db.query('SELECT name FROM categories')).rows[0].name, 'Beverages');
      const duplicate = await admin('/categories', { csrf, name: 'beverages' });
      assert.equal(duplicate.status, 409);
      assert.ok(duplicate.text.includes('Tên danh mục này đã tồn tại'));
      assert.ok(duplicate.text.includes('value="beverages"'));
      const list = await admin(created.location);
      assert.ok(list.text.includes('Đã thêm danh mục.'));
      assert.equal(await total(), 1);
    });

    const firstId = (await db.query('SELECT id FROM categories')).rows[0].id;
    await t.test('renames categories, rejects duplicates and keeps the edit form open on errors', async () => {
      await admin('/categories', { csrf, name: 'Food' });
      const changed = await admin(`/categories/${firstId}/edit`, { csrf, name: 'Drinks' });
      assert.equal(changed.status, 303);
      assert.equal(changed.location, '/categories?saved=renamed');
      const duplicate = await admin(`/categories/${firstId}/edit`, { csrf, name: 'food' });
      assert.equal(duplicate.status, 409);
      assert.ok(duplicate.text.includes('class="category-edit" open'));
      assert.ok(duplicate.text.includes('value="food"'));
      assert.equal((await db.query('SELECT name FROM categories WHERE id=$1', [firstId])).rows[0].name, 'Drinks');
      assert.equal((await admin(`/categories/${firstId}/edit`, { csrf, name: '' })).status, 400);
      assert.equal((await admin('/categories/2147483647/edit', { csrf, name: 'Missing' })).status, 404);
    });

    await t.test('sets explicit status and preserves referenced products', async () => {
      await db.query('INSERT INTO products(sku,name,category_id,base_price,current_price) VALUES ($1,$2,$3,$4,$4)', ['CAT-TEST', 'Existing product', firstId, 100000]);
      const stopped = await admin(`/categories/${firstId}/status`, { csrf, active: 'false' });
      assert.equal(stopped.location, '/categories?saved=deactivated');
      assert.equal((await db.query('SELECT is_active FROM categories WHERE id=$1', [firstId])).rows[0].is_active, false);
      assert.equal((await db.query('SELECT category_id FROM products')).rows[0].category_id, firstId);
      await admin(`/categories/${firstId}/status`, { csrf, active: 'false' });
      assert.equal((await db.query('SELECT is_active FROM categories WHERE id=$1', [firstId])).rows[0].is_active, false);
      const reopened = await admin(`/categories/${firstId}/status`, { csrf, active: 'true' });
      assert.equal(reopened.location, '/categories?saved=activated');
      assert.equal((await db.query('SELECT is_active FROM categories WHERE id=$1', [firstId])).rows[0].is_active, true);
      assert.equal((await admin(`/categories/${firstId}/status`, { csrf, active: 'maybe' })).status, 400);
      assert.equal((await admin('/categories/2147483647/status', { csrf, active: 'false' })).status, 404);
    });

    await t.test('rejects forged mutation requests and invalid identifiers', async () => {
      const staffPage = await staff('/staff');
      for (const action of ['edit', 'status']) {
        assert.equal((await staff(`/categories/${firstId}/${action}`, { csrf: staffPage.csrf, name: 'Forbidden', active: 'false' })).status, 403);
        assert.equal((await admin(`/categories/${firstId}/${action}`, { name: 'No token', active: 'false' })).status, 403);
        const get = await admin(`/categories/${firstId}/${action}`);
        assert.equal(get.status, 405);
        assert.equal(get.allow, 'POST');
      }
      for (const id of ['abc', '0', '-1', '1.5', '2147483648', '01']) assert.equal((await admin(`/categories/${id}/edit`, { csrf, name: 'Bad ID' })).status, 400);
      assert.equal((await admin('/categories/unknown')).status, 404);
      assert.equal((await db.query('SELECT name FROM categories WHERE id=$1', [firstId])).rows[0].name, 'Drinks');
    });

    await t.test('escapes stored and reflected HTML and uses parameterized queries', async () => {
      const name = `<script>alert('category')</script>`;
      assert.equal((await admin('/categories', { csrf, name })).status, 303);
      const list = await admin('/categories');
      assert.ok(list.text.includes('&lt;script&gt;'));
      assert.ok(!list.text.includes(name));
      const sqlName = "O'Reilly'); DROP TABLE public.categories; --";
      assert.equal((await admin('/categories', { csrf, name: sqlName })).status, 303);
      assert.equal(await total(), 4);
      assert.equal((await db.query('SELECT name FROM categories WHERE name=$1', [sqlName])).rows[0].name, sqlName);
      const arbitraryNotice = await admin('/categories?saved=constructor');
      assert.ok(!arbitraryNotice.text.includes('function Object'));
    });
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    sessions.clear();
    await db.close();
  }
});
