const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { applySchema } = require('./helpers/schema');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/services/password');
const { sessions } = require('../src/services/session');
const { transaction } = require('../src/utils/transaction');
const { applyStockChange } = require('../src/services/inventory');

test('integrated inventory and sales through authenticated HTTP and PostgreSQL', async t => {
  const db = new PGlite();
  let server;
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
    const hash = await hashPassword('Testing@123');
    for (const [name, role] of [['admin','admin'],['staff','staff'],['other','staff']]) await db.query('INSERT INTO users(name,email,role,password_hash) VALUES ($1,$2,$3,$4)', [name, `${name}@test.invalid`, role, hash]);
    await db.exec("INSERT INTO categories(name) VALUES ('Inventory tests'); INSERT INTO products(sku,name,category_id,base_price,current_price,stock) VALUES ('TEST-1','Tea',1,100000,100000,11),('TEST-2','Other staff only product',1,200000,200000,100); INSERT INTO products(sku,name,category_id,base_price,current_price,is_active) VALUES ('STOPPED','Stopped product',1,10000,10000,false); INSERT INTO pricing_rules(product_id,low_stock,high_stock,increase_percent,discount_percent,min_price,max_price) VALUES (1,10,100,10,10,50000,200000)");
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
        return { status: response.status, text, location: response.headers.get('location'), type: response.headers.get('content-type'), csrf: text.match(/name="csrf" value="([a-f0-9]+)"/)?.[1] };
      };
    }
    const admin = client(), staff = client(), other = client(), guest = client();
    for (const [request, name] of [[admin,'admin'],[staff,'staff'],[other,'other']]) {
      const page = await request('/login');
      assert.equal((await request('/login', { csrf: page.csrf, email: `${name}@test.invalid`, password: 'Testing@123' })).status, 303);
    }
    const adminCsrf = (await admin('/inventory/receive')).csrf;
    const staffCsrf = (await staff('/sales')).csrf;
    const otherCsrf = (await other('/sales')).csrf;
    const stock = async () => (await db.query('SELECT stock,current_price FROM products WHERE id=1')).rows[0];
    const count = async table => (await db.query(`SELECT count(*)::integer AS total FROM ${table}`)).rows[0].total;
    const reset = async () => db.exec('UPDATE products SET stock=11,current_price=100000 WHERE id=1');
    const jsonOptions = { headers: { accept: 'application/json' } };
    const sale = { csrf: staffCsrf, product_id: '1', quantity: '2' };
    const receive = { csrf: adminCsrf, product_id: '1', quantity: '2' };

    await t.test('serves real role-specific forms and preserves account, category, product, image and CSS routes', async () => {
      for (const [request, path] of [[admin,'/inventory/receive'],[admin,'/inventory/adjust'],[staff,'/sales']]) {
        const page = await request(path);
        assert.equal(page.status, 200);
        assert.match(page.type, /text\/html/);
        assert.ok(page.text.includes(`action="${path}"`));
        assert.ok(!page.text.includes('ĐANG PHÁT TRIỂN'));
        assert.ok(page.csrf);
        assert.ok(!page.text.includes('Stopped product'));
      }
      for (const path of ['/users','/categories','/products','/products/1/edit']) assert.equal((await admin(path)).status, 200);
      assert.equal((await staff('/products')).status, 200);
      assert.equal((await staff('/products/1/image')).status, 404);
      assert.equal((await guest('/tokens.css')).status, 200);
      assert.equal((await guest('/base.css')).status, 200);
      assert.equal((await admin('/test-ui')).status, 404);
    });

    await t.test('blocks guests and forbidden roles, unsupported methods and non-form posts', async () => {
      for (const path of ['/sales','/sales/history','/inventory/receive','/inventory/adjust','/inventory/history','/inventory/low-stock','/admin/sales-history']) assert.equal((await guest(path)).location, '/login');
      assert.equal((await admin('/sales')).status, 403);
      assert.equal((await admin('/sales', receive)).status, 403);
      assert.equal((await admin('/sales/history')).status, 403);
      for (const path of ['/inventory/receive','/inventory/adjust','/inventory/history','/admin/sales-history']) {
        assert.equal((await staff(path)).status, 403);
        assert.equal((await staff(path, sale)).status, 403);
      }
      for (const [request, path] of [[admin,'/inventory/receive'],[admin,'/inventory/adjust'],[staff,'/sales']]) {
        assert.equal((await request(path, receive, { headers: { 'content-type': 'application/json' } })).status, 415);
        assert.equal((await request(path, undefined, { method: 'DELETE' })).status, 405);
      }
      assert.equal((await admin('/inventory/history', receive)).status, 405);
      assert.equal((await staff('/sales/history', sale)).status, 405);
    });

    await t.test('requires a real CSRF token for receive, adjustment and sale without changing data on failure', async () => {
      const before = await stock();
      const movements = await count('stock_movements');
      for (const [request, path, form] of [[admin,'/inventory/receive',receive],[admin,'/inventory/adjust',{ ...receive,type:'ADJUST_IN',note:'Counted' }],[staff,'/sales',sale]]) {
        for (const csrf of ['', 'wrong', undefined]) {
          const fields = { ...form, csrf };
          if (csrf === undefined) delete fields.csrf;
          assert.equal((await request(path, fields)).status, 403);
        }
      }
      assert.deepEqual(await stock(), before);
      assert.equal(await count('stock_movements'), movements);
    });

    await t.test('receives and sells with the correct token; applies thresholds while preserving the original sale price', async () => {
      const received = await admin('/inventory/receive', receive);
      assert.equal(received.location, '/inventory/history?saved=receive');
      assert.equal(received.status, 303);
      assert.equal((await stock()).stock, 13);
      const sold = await staff('/sales', { ...sale, quantity: '4', user_id: '1', unit_price: '1' });
      assert.equal(sold.location, '/sales/history?saved=sold');
      const row = await stock();
      assert.equal(row.stock, 9);
      assert.equal(Number(row.current_price), 110000);
      const movement = (await db.query("SELECT * FROM stock_movements WHERE type='SALE' ORDER BY id DESC LIMIT 1")).rows[0];
      assert.equal(movement.user_id, 2);
      assert.equal(Number(movement.unit_price), 100000);
      assert.equal(movement.quantity, 4);
      const price = (await db.query('SELECT * FROM price_history ORDER BY id DESC LIMIT 1')).rows[0];
      assert.equal(Number(price.old_price), 100000);
      assert.equal(Number(price.new_price), 110000);
      assert.equal(price.changed_by, 2);
      await staff('/sales', { ...sale, quantity: '1' });
      assert.equal(Number((await stock()).current_price), 110000);
      assert.equal(await count('price_history'), 1);
    });

    await t.test('rejects malformed quantities and IDs at both HTTP and service boundaries', async () => {
      const before = await stock();
      const movements = await count('stock_movements');
      for (const quantity of ['1.5','2abc','-1','0','NaN','Infinity','1e2','2147483648','']) {
        assert.equal((await staff('/sales', { ...sale, quantity })).status, 400, quantity);
        assert.equal((await admin('/inventory/receive', { ...receive, quantity })).status, 400, quantity);
      }
      for (const product_id of ['1abc','1.5','0','-1','2147483648','']) assert.equal((await staff('/sales', { ...sale, product_id })).status, 400);
      assert.equal((await staff('/sales', { ...sale, product_id: '2147483647' })).status, 404);
      assert.equal((await staff('/sales', { ...sale, product_id: '3' })).status, 404);
      await assert.rejects(transaction(pool, client => applyStockChange(client, 1, 'SALE', 1.5, 2)), error => error.status === 400);
      await assert.rejects(transaction(pool, client => applyStockChange(client, 1, 'UNKNOWN', 1, 1)), error => error.status === 400);
      assert.deepEqual(await stock(), before);
      assert.equal(await count('stock_movements'), movements);
    });

    await t.test('only allows ADJUST_IN/ADJUST_OUT with a reason; escapes reflected and stored notes', async () => {
      await reset();
      const adjustment = { ...receive, type: 'ADJUST_OUT', note: 'Physical count' };
      for (const type of ['IN','SALE','RETURN','DAMAGE','unknown','']) assert.equal((await admin('/inventory/adjust', { ...adjustment, type })).status, 400);
      for (const note of ['', '   ', 'x'.repeat(1001), 'Bad\u0000note']) assert.equal((await admin('/inventory/adjust', { ...adjustment, note })).status, 400);
      const unsafe = '<script>alert(1)</script>';
      const invalid = await admin('/inventory/adjust', { ...adjustment, quantity: '1.5', note: unsafe });
      assert.equal(invalid.status, 400);
      assert.ok(!invalid.text.includes(unsafe));
      assert.ok(invalid.text.includes('&lt;script&gt;'));
      assert.ok(invalid.text.includes('value="1.5"'));
      assert.equal((await admin('/inventory/adjust', { ...adjustment, note: unsafe })).status, 303);
      assert.equal((await stock()).stock, 9);
      assert.equal(Number((await stock()).current_price), 110000);
      const history = await admin('/inventory/history');
      assert.ok(history.text.includes('&lt;script&gt;'));
      assert.ok(!history.text.includes(unsafe));
      assert.equal((await admin('/inventory/adjust', { ...adjustment, type: 'ADJUST_IN', quantity: '2' })).status, 303);
      assert.equal((await stock()).stock, 11);
      assert.equal(Number((await stock()).current_price), 100000);
    });

    await t.test('rejects over-selling, excessive decrements, oversized bodies and stock overflow atomically', async () => {
      await reset();
      const movements = await count('stock_movements');
      assert.equal((await staff('/sales', { ...sale, quantity: '12' })).status, 409);
      assert.equal((await admin('/inventory/adjust', { ...receive, type:'ADJUST_OUT',quantity:'12',note:'Count' })).status, 409);
      assert.equal((await admin('/inventory/receive', { ...receive, note:'x'.repeat(9000) })).status, 413);
      assert.equal((await stock()).stock, 11);
      assert.equal(await count('stock_movements'), movements);
      await db.exec('UPDATE products SET stock=2147483647 WHERE id=1');
      assert.equal((await admin('/inventory/receive', { ...receive, quantity:'1' })).status, 400);
      assert.equal((await stock()).stock, 2147483647);
      await reset();
    });

    await t.test('returns HTML histories by default and scoped JSON without exposing base prices', async () => {
      await other('/sales', { csrf:otherCsrf,product_id:'2',quantity:'1' });
      const own = await staff('/sales/history?user_id=3', undefined, jsonOptions);
      assert.match(own.type, /application\/json/);
      const entries = JSON.parse(own.text);
      assert.ok(entries.length > 0 && entries.every(row => row.userId === 2 && row.type === 'SALE'));
      assert.ok(!entries.some(row => Object.hasOwn(row, 'basePrice') || Object.hasOwn(row, 'base_price')));
      const ownHtml = await staff('/sales/history');
      assert.match(ownHtml.type, /text\/html/);
      assert.ok(!ownHtml.text.includes('Other staff only product'));
      const all = JSON.parse((await admin('/admin/sales-history', undefined, jsonOptions)).text);
      assert.ok(all.some(row => row.userId === 3));
      assert.ok(all.every(row => row.type === 'SALE'));
      assert.ok((await admin('/admin/sales-history')).text.includes('Other staff only product'));
      assert.ok((await admin('/inventory/history')).text.includes('Nhập kho'));
    });

    await t.test('low-stock results respect thresholds and active status without returning pricing rules to staff', async () => {
      await reset();
      const before = JSON.parse((await staff('/inventory/low-stock', undefined, jsonOptions)).text);
      assert.ok(!before.some(row => row.id === 1 || row.id === 2 || row.id === 3));
      await staff('/sales', sale);
      const result = await staff('/inventory/low-stock', undefined, jsonOptions);
      const rows = JSON.parse(result.text);
      assert.ok(rows.some(row => row.id === 1 && row.stock === 9));
      assert.ok(rows.every(row => !Object.hasOwn(row,'basePrice') && !Object.hasOwn(row,'low_stock') && !Object.hasOwn(row,'increase_percent')));
      const html = await staff('/inventory/low-stock');
      assert.match(html.type, /text\/html/);
      assert.ok(html.text.includes('Tea'));
      assert.ok(!html.text.includes('Giá cơ sở'));
    });

    await t.test('uses original return price, protects return limits and requires reasons for damage', async () => {
      await reset();
      const sold = await transaction(pool, client => applyStockChange(client, 1, 'SALE', 2, 2));
      assert.equal(Number(sold.unitPrice), 100000);
      const returned = await transaction(pool, client => applyStockChange(client, 1, 'RETURN', 1, 1, null, sold.id));
      assert.equal(Number(returned.unitPrice), 100000);
      assert.equal((await stock()).stock, 10);
      await assert.rejects(transaction(pool, client => applyStockChange(client, 1, 'RETURN', 2, 1, null, sold.id)), error => error.status === 409);
      await assert.rejects(transaction(pool, client => applyStockChange(client, 2, 'RETURN', 1, 1, null, sold.id)), error => error.status === 400);
      await assert.rejects(transaction(pool, client => applyStockChange(client, 1, 'DAMAGE', 1, 1)), error => error.status === 400);
      await transaction(pool, client => applyStockChange(client, 1, 'DAMAGE', 1, 1, 'Damaged package'));
      assert.equal((await stock()).stock, 9);
      await db.exec('UPDATE users SET is_active=false WHERE id=3');
      await assert.rejects(transaction(pool, client => applyStockChange(client, 1, 'SALE', 1, 3)), error => error.status === 403);
      await db.exec('UPDATE users SET is_active=true WHERE id=3');
    });

    await t.test('rolls back stock, movement and price together if price history fails', async () => {
      await reset();
      const movements = await count('stock_movements');
      const prices = await count('price_history');
      await db.exec('CREATE FUNCTION reject_stock_price_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'stock price failure\'; END $$; CREATE TRIGGER reject_stock_price_test BEFORE INSERT ON price_history FOR EACH ROW EXECUTE FUNCTION reject_stock_price_test()');
      try { assert.equal((await staff('/sales', sale)).status, 500); }
      finally { await db.exec('DROP TRIGGER reject_stock_price_test ON price_history; DROP FUNCTION reject_stock_price_test()'); }
      assert.equal((await stock()).stock, 11);
      assert.equal(Number((await stock()).current_price), 100000);
      assert.equal(await count('stock_movements'), movements);
      assert.equal(await count('price_history'), prices);
    });

    await t.test('simultaneous HTTP sales serialize through transactions without overselling', async () => {
      await reset();
      const responses = await Promise.all([staff('/sales', { ...sale, quantity:'8' }),other('/sales', { csrf:otherCsrf,product_id:'1',quantity:'8' })]);
      assert.deepEqual(responses.map(row => row.status).sort(), [303,409]);
      assert.equal((await stock()).stock, 3);
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    sessions.clear();
    await db.close();
  }
});
