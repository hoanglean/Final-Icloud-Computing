const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applySchema } = require('./helpers/schema');
const { PGlite } = require('@electric-sql/pglite');
const { createApp } = require('../src/app');
const { hashPassword, matches } = require('../src/services/password');
const { sessions } = require('../src/services/session');
const { createProductRepository } = require('../src/repositories/products');
const { recalculatePrice } = require('../src/services/pricing');
const { transaction } = require('../src/utils/transaction');

test('task 1 account and product management through HTTP and PostgreSQL', async t => {
  const db = new PGlite();
  let server;
  // PGlite has one connection; serialize checked-out clients as a real pool would.
  let available = Promise.resolve();
  const pool = {
    async query(sql, values) {
      const result = await db.query(sql, values);
      return { rows: result.rows, rowCount: result.affectedRows };
    },
    async connect() {
      const previous = available;
      let release;
      available = new Promise(resolve => { release = resolve; });
      await previous;
      return { query: pool.query, release };
    },
    async end() {}
  };
  try {
    await applySchema(db);
    const password = 'Testing@123';
    const hash = await hashPassword(password);
    for (const role of ['admin', 'staff']) await db.query('INSERT INTO users(name,email,role,password_hash) VALUES ($1,$2,$3,$4)', [role, `${role}@test.invalid`, role, hash]);
    await db.exec("INSERT INTO categories(name) VALUES ('Beverages'), ('Food'); INSERT INTO categories(name,is_active) VALUES ('Stopped',false)");
    server = await createApp({ pool });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}`;
    function client() {
      let cookie = '';
      return async (route, form, options = {}) => {
        const response = await fetch(base + route, {
          method: form ? 'POST' : 'GET', redirect: 'manual', ...options,
          headers: { cookie, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...options.headers },
          ...(form ? { body: new URLSearchParams(form) } : {})
        });
        if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        const text = await response.text();
        return { status: response.status, location: response.headers.get('location'), text, csrf: text.match(/name="csrf" value="([a-f0-9]+)"/)?.[1] };
      };
    }
    async function login(request, email) {
      const page = await request('/login');
      assert.equal((await request('/login', { csrf: page.csrf, email, password })).status, 303);
      return (await request('/')).csrf || (await request('/products')).csrf;
    }
    const admin = client(), staff = client(), guest = client();
    await login(admin, 'admin@test.invalid');
    await login(staff, 'staff@test.invalid');
    const csrf = (await admin('/users')).csrf;
    const staffCsrf = (await staff('/products')).csrf;
    const userForm = { csrf, name: 'New employee', email: 'employee@test.invalid', role: 'staff', password };
    const product = { csrf, name: 'Tea 50%', categoryId: '1', basePrice: '100000.50', stock: '999', currentPrice: '1' };
    let employeeId, productId;

    await t.test('requires authentication, correct role, CSRF and form encoding', async () => {
      for (const route of ['/users', '/products', '/products/new', '/users/1/access', '/products/1/edit']) assert.equal((await guest(route)).location, '/login');
      assert.equal((await staff('/users')).status, 403);
      for (const route of ['/users', '/users/1/access', '/products', '/products/1/edit', '/products/1/status']) assert.equal((await staff(route, { ...product, csrf: staffCsrf, role: 'admin' })).status, 403);
      assert.equal((await staff('/products/new')).status, 403);
      assert.equal((await staff('/products/1/edit')).status, 403);
      for (const route of ['/users', '/products']) {
        assert.equal((await admin(route, { ...product, csrf: 'wrong' })).status, 403);
        assert.equal((await admin(route, product, { headers: { 'content-type': 'application/json' } })).status, 415);
        assert.equal((await admin(route, undefined, { method: 'DELETE' })).status, 405);
      }
      assert.equal((await admin('/products/new', product)).status, 405);
      assert.equal((await admin('/products/1/status')).status, 405);
    });

    await t.test('creates normalized accounts with hashed passwords and never reflects secrets', async () => {
      const result = await admin('/users', { ...userForm, name: ' New employee ', email: ' Employee@Test.Invalid ' });
      assert.equal(result.location, '/users?saved=created');
      const row = (await db.query("SELECT * FROM users WHERE email='employee@test.invalid'")).rows[0];
      employeeId = row.id;
      assert.equal(row.name, 'New employee');
      assert.notEqual(row.password_hash, password);
      assert.equal(await matches(password, row.password_hash), true);
      const page = await admin('/users');
      assert.ok(page.text.includes(row.email));
      assert.ok(!page.text.includes(row.password_hash));
      const duplicate = await admin('/users', userForm);
      assert.equal(duplicate.status, 409);
      assert.ok(duplicate.text.includes('value="employee@test.invalid"'));
      assert.ok(!duplicate.text.includes(password));
      for (const values of [{ name: '' }, { name: 'x'.repeat(121) }, { email: 'invalid' }, { role: 'superadmin' }, { password: 'lowercase' }, { name: 'Bad\u0000name' }]) {
        const response = await admin('/users', { ...userForm, email: 'invalidcase@test.invalid', ...values });
        assert.equal(response.status, 400);
        assert.ok(!response.text.includes(password));
      }
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM users')).rows[0].total, 3);
    });

    await t.test('locks, unlocks and changes roles while permanently invalidating old sessions', async () => {
      const employee = client();
      await login(employee, userForm.email);
      assert.equal((await employee('/products')).status, 200);
      const access = { csrf, role: 'staff', active: 'false' };
      assert.equal((await admin(`/users/${employeeId}/access`, access)).status, 303);
      assert.equal((await employee('/products')).location, '/login');
      const version = (await db.query('SELECT session_version FROM users WHERE id=$1', [employeeId])).rows[0].session_version;
      assert.equal(version, 2);
      await admin(`/users/${employeeId}/access`, { ...access, active: 'true' });
      assert.equal((await employee('/products')).location, '/login');
      await login(employee, userForm.email);
      await admin(`/users/${employeeId}/access`, { ...access, role: 'admin', active: 'true' });
      assert.equal((await employee('/users')).location, '/login');
      await login(employee, userForm.email);
      assert.equal((await employee('/users')).status, 200);
      await admin(`/users/${employeeId}/access`, { ...access, active: 'true' });
      assert.equal((await employee('/users')).location, '/login');
      const before = (await db.query('SELECT session_version FROM users WHERE id=$1', [employeeId])).rows[0].session_version;
      await admin(`/users/${employeeId}/access`, { ...access, active: 'true' });
      assert.equal((await db.query('SELECT session_version FROM users WHERE id=$1', [employeeId])).rows[0].session_version, before);
    });

    await t.test('protects the last active admin and rejects forged access changes', async () => {
      assert.equal((await admin('/users/1/access', { csrf, role: 'admin', active: 'false' })).status, 409);
      assert.equal((await admin('/users/1/access', { csrf, role: 'staff', active: 'true' })).status, 409);
      assert.equal((await admin('/users/1/access', { role: 'staff', active: 'true' })).status, 403);
      assert.equal((await admin('/users/1/access', { csrf, role: 'owner', active: 'true' })).status, 400);
      assert.equal((await admin('/users/1/access', { csrf, role: 'admin', active: 'yes' })).status, 400);
      assert.equal((await admin('/users/2147483647/access', { csrf, role: 'staff', active: 'true' })).status, 404);
      for (const id of ['0', '01', '-1', 'abc', '2147483648']) assert.equal((await admin(`/users/${id}/access`, { csrf, role: 'staff', active: 'true' })).status, 400);
      assert.equal((await admin('/users/1/access')).status, 405);
      assert.equal((await admin('/users/1/delete', { csrf })).status, 404);
      assert.equal((await db.query('SELECT role,is_active FROM users WHERE id=1')).rows[0].role, 'admin');
    });

    await t.test('creates products without SKU input using generated immutable IDs and zero stock', async () => {
      const form = await admin('/products/new');
      assert.equal(form.status, 200);
      assert.ok(!form.text.includes('name="sku"'));
      assert.ok(form.text.includes('id="product-id" value="Tự động tạo khi lưu" readonly'));
      const created = await admin('/products', { ...product, id: '2147483647', sku: 'CLIENT-CODE' });
      assert.equal(created.location, '/products?saved=created');
      const row = (await db.query('SELECT * FROM products')).rows[0];
      productId = row.id;
      assert.ok(Number.isInteger(row.id) && row.id > 0);
      assert.notEqual(row.id, 2147483647);
      assert.notEqual(row.sku, 'CLIENT-CODE');
      assert.equal(row.stock, 0);
      assert.equal(Number(row.base_price), 100000.5);
      assert.equal(Number(row.current_price), 100001);
      for (const values of [{ name: '' }, { name: 'x'.repeat(201) }, { categoryId: '0' }, { basePrice: '-1' }, { basePrice: 'NaN' }, { basePrice: 'Infinity' }, { basePrice: '1e3' }, { basePrice: '1.001' }, { basePrice: '1000000000000' }]) {
        assert.equal((await admin('/products', { ...product, ...values })).status, 400, JSON.stringify(values));
      }
      for (const categoryId of ['3', '2147483647']) assert.equal((await admin('/products', { ...product, categoryId })).status, 409);
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM products')).rows[0].total, 1);
    });

    await t.test('supports name/ID search and category/status filters without leaking base price or legacy SKU', async () => {
      await admin('/products', { ...product, sku: 'CLIENT-CODE', name: 'Bread', categoryId: '2', basePrice: '731234.56' });
      const found = await staff(`/products?q=${productId}&category=1&status=active`);
      assert.ok(found.text.includes('Tea 50%'));
      assert.ok(!found.text.includes('Bread'));
      assert.ok(found.text.includes(`ID: ${productId}`));
      assert.ok((await staff('/products?q=tea')).text.includes('Tea 50%'));
      for (const secret of ['SKU', 'CLIENT-CODE', 'Giá cơ sở', 'basePrice', 'base_price', '731234.56', 'pricing_rules', 'Thêm sản phẩm', 'Sửa sản phẩm']) assert.ok(!found.text.includes(secret), secret);
      assert.ok((await admin('/products')).text.includes('Giá cơ sở'));
      const staffRows = await createProductRepository(pool).list({}, false);
      assert.ok(staffRows.every(row => !Object.hasOwn(row, 'basePrice')));
      assert.ok(staffRows.every(row => !Object.hasOwn(row, 'sku')));
      assert.ok((await staff('/products?q=%25')).text.includes('Tea 50%'));
      assert.ok(!(await staff('/products?q=%25')).text.includes('Bread'));
      assert.ok(!(await staff('/products?category=2')).text.includes('Tea 50%'));
      for (const query of ['status=unexpected', 'category=-1', 'q=' + 'x'.repeat(201)]) assert.equal((await staff('/products?' + query)).status, 400);
      assert.ok((await staff('/products?q=' + encodeURIComponent("'; DROP TABLE products; --"))).text.includes('Không có sản phẩm phù hợp'));
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM products')).rows[0].total, 2);
    });

    await t.test('edits metadata and status without overwriting stock, prices or history from submitted fields', async () => {
      await db.query('UPDATE products SET stock=11 WHERE id=$1', [productId]);
      assert.equal((await admin(`/products/${productId}/edit`)).status, 200);
      const original = (await db.query('SELECT id,sku FROM products WHERE id=$1', [productId])).rows[0];
      assert.equal((await admin(`/products/${productId}/edit`, { ...product, id: '2147483647', sku: 'FORGED', name: 'Renamed tea', stock: '1000', currentPrice: '0' })).status, 303);
      let row = (await db.query('SELECT * FROM products WHERE id=$1', [productId])).rows[0];
      assert.equal(row.stock, 11);
      assert.equal(row.id, original.id);
      assert.equal(row.sku, original.sku);
      assert.equal(Number(row.current_price), 100001);
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM price_history')).rows[0].total, 0);
      const invalid = await admin(`/products/${productId}/edit`, { ...product, name: '', basePrice: '12345' });
      assert.equal(invalid.status, 400);
      assert.ok(invalid.text.includes(`action="/products/${productId}/edit"`));
      assert.ok(invalid.text.includes(`id="product-id" value="${productId}" readonly`));
      assert.ok(invalid.text.includes('value="12345"'));
      assert.equal((await admin(`/products/${productId}/status`, { csrf, active: 'false' })).status, 303);
      assert.ok((await staff('/products?status=inactive')).text.includes('Renamed tea'));
      assert.ok(!(await staff('/products?status=active')).text.includes('Renamed tea'));
      await db.exec('UPDATE categories SET is_active=false WHERE id=1');
      assert.equal((await admin(`/products/${productId}/status`, { csrf, active: 'true' })).status, 409);
      assert.equal((await admin(`/products/${productId}/edit`, { ...product, name: 'Retained category' })).status, 303);
      await db.exec('UPDATE categories SET is_active=true WHERE id=1');
      assert.equal((await admin(`/products/${productId}/status`, { csrf, active: 'true' })).status, 303);
      row = (await db.query('SELECT * FROM products WHERE id=$1', [productId])).rows[0];
      assert.equal(row.stock, 11);
      assert.equal(row.is_active, true);
      for (const route of [`/products/${productId}/edit`, `/products/${productId}/status`]) assert.equal((await admin(route, { ...product, csrf: 'wrong', active: 'false' })).status, 403);
      for (const id of ['0', '01', 'x', '2147483648']) {
        assert.equal((await admin(`/products/${id}/edit`)).status, 400);
        assert.equal((await admin(`/products/${id}/status`, { csrf, active: 'false' })).status, 400);
      }
      assert.equal((await admin('/products/2147483647/edit')).status, 404);
      assert.equal((await admin('/products/2147483647/edit', product)).status, 404);
      assert.equal((await admin('/products/2147483647/status', { csrf, active: 'false' })).status, 404);
      assert.equal((await admin(`/products/${productId}/status`, { csrf, active: 'maybe' })).status, 400);
    });

    await t.test('accepts zero prices and safely rounds the maximum supported amount', async () => {
      for (const [name, basePrice, expected] of [['Free item', '0', 0], ['Maximum item', '999999999999.99', 999999999999]]) {
        assert.equal((await admin('/products', { ...product, name, basePrice })).status, 303);
        const row = (await db.query('SELECT current_price,stock FROM products WHERE name=$1', [name])).rows[0];
        assert.equal(Number(row.current_price), expected);
        assert.equal(row.stock, 0);
      }
    });

    await t.test('recalculates price atomically when base price changes and records actor and original price', async () => {
      await db.query('INSERT INTO pricing_rules(product_id,low_stock,high_stock,increase_percent,discount_percent,min_price,max_price) VALUES ($1,10,100,10,10,500,5000000)', [productId]);
      await db.query('UPDATE products SET stock=10 WHERE id=$1', [productId]);
      assert.equal((await admin(`/products/${productId}/edit`, { ...product, basePrice: '200000' })).status, 303);
      let row = (await db.query('SELECT * FROM products WHERE id=$1', [productId])).rows[0];
      assert.equal(Number(row.current_price), 220000);
      assert.equal(row.stock, 10);
      const history = (await db.query('SELECT * FROM price_history WHERE product_id=$1', [productId])).rows[0];
      assert.equal(Number(history.old_price), 100001);
      assert.equal(Number(history.new_price), 220000);
      assert.equal(history.changed_by, 1);
      assert.equal(history.reason, 'Thay đổi giá cơ sở');
      await admin(`/products/${productId}/edit`, { ...product, basePrice: '200000' });
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM price_history')).rows[0].total, 1);
      await db.exec('CREATE FUNCTION reject_test_price() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'test history failure\'; END $$; CREATE TRIGGER reject_test_price BEFORE INSERT ON price_history FOR EACH ROW EXECUTE FUNCTION reject_test_price()');
      try {
        assert.equal((await admin(`/products/${productId}/edit`, { ...product, name: 'Must roll back', basePrice: '300000' })).status, 500);
      } finally {
        await db.exec('DROP TRIGGER reject_test_price ON price_history; DROP FUNCTION reject_test_price()');
      }
      row = (await db.query('SELECT * FROM products WHERE id=$1', [productId])).rows[0];
      assert.equal(row.name, product.name);
      assert.equal(Number(row.base_price), 200000);
      assert.equal(Number(row.current_price), 220000);
      assert.equal(row.stock, 10);
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM price_history')).rows[0].total, 1);
    });

    await t.test('shared pricing handles inclusive thresholds, clamps, disabled rules and rounding without accumulation', async () => {
      async function recalculate(stock) {
        await db.query('UPDATE products SET stock=$2,base_price=100000 WHERE id=$1', [productId, stock]);
        await transaction(pool, async client => {
          await client.query('SELECT id FROM products WHERE id=$1 FOR UPDATE', [productId]);
          await recalculatePrice(client, productId, 1, 'Test pricing');
        });
        return Number((await db.query('SELECT current_price FROM products WHERE id=$1', [productId])).rows[0].current_price);
      }
      for (const [stock, expected] of [[0,110000],[10,110000],[11,100000],[99,100000],[100,90000],[101,90000]]) assert.equal(await recalculate(stock), expected);
      await db.query('UPDATE pricing_rules SET min_price=95000,max_price=105000 WHERE product_id=$1', [productId]);
      assert.equal(await recalculate(0), 105000);
      assert.equal(await recalculate(100), 95000);
      await db.query('UPDATE pricing_rules SET enabled=false WHERE product_id=$1', [productId]);
      assert.equal(await recalculate(0), 100000);
      const count = (await db.query('SELECT count(*)::integer AS total FROM price_history')).rows[0].total;
      assert.equal(await recalculate(0), 100000);
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM price_history')).rows[0].total, count);
      await admin(`/products/${productId}/edit`, { ...product, basePrice: '100000.49' });
      assert.equal(Number((await db.query('SELECT current_price FROM products WHERE id=$1', [productId])).rows[0].current_price), 100000);
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM price_history')).rows[0].total, count);
    });

    await t.test('escapes product and account content in HTML and preserves history on deactivation', async () => {
      const unsafe = '<img src=x onerror=alert(1)>';
      await admin('/users', { ...userForm, name: unsafe, email: 'escape@test.invalid' });
      assert.ok(!(await admin('/users')).text.includes(unsafe));
      assert.ok((await admin('/users')).text.includes('&lt;img'));
      await admin('/products', { ...product, name: unsafe });
      for (const request of [admin, staff]) {
        const page = await request('/products');
        assert.ok(page.text.includes('&lt;img'));
        assert.ok(!page.text.includes(unsafe));
      }
      const historyCount = (await db.query('SELECT count(*)::integer AS total FROM price_history')).rows[0].total;
      await admin(`/products/${productId}/status`, { csrf, active: 'false' });
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM price_history')).rows[0].total, historyCount);
      assert.equal((await db.query('SELECT stock FROM products WHERE id=$1', [productId])).rows[0].stock, 0);
      assert.equal((await admin(`/products/${productId}/delete`, { csrf })).status, 404);
    });

    await t.test('concurrent admin access changes leave one active admin; self-demotion logs out', async () => {
      await admin('/users', { ...userForm, email: 'secondadmin@test.invalid', role: 'admin' });
      const secondId = (await db.query("SELECT id FROM users WHERE email='secondadmin@test.invalid'")).rows[0].id;
      const second = client();
      await login(second, 'secondadmin@test.invalid');
      const secondCsrf = (await second('/users')).csrf;
      const responses = await Promise.all([
        admin('/users/1/access', { csrf, role: 'staff', active: 'true' }),
        second(`/users/${secondId}/access`, { csrf: secondCsrf, role: 'staff', active: 'true' })
      ]);
      assert.deepEqual(responses.map(response => response.status).sort(), [303, 409]);
      assert.ok(responses.some(response => response.location === '/login'));
      assert.equal((await db.query("SELECT count(*)::integer AS total FROM users WHERE role='admin' AND is_active=true")).rows[0].total, 1);
      assert.ok([(await admin('/users')).status, (await second('/users')).status].includes(303));
    });
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    sessions.clear();
    await db.close();
  }
});
