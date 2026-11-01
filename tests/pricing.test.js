const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { applySchema } = require('./helpers/schema');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/services/password');
const { createPricingRepository } = require('../src/repositories/pricing');
const {
  recalculatePrice,
  savePricingRule,
  togglePricingRule,
  recalculateProductPriceManually
} = require('../src/services/pricing');

function createTestPool(db) {
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
  return pool;
}

test('dynamic pricing service and repository business rules', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await applySchema(db);
  const pool = createTestPool(db);
  const pricingRepository = createPricingRepository(pool);

  const hash = await hashPassword('AdminPass@123');
  await db.query(`INSERT INTO users(name, email, role, password_hash, session_version)
    VALUES ('Admin User', 'admin@test.local', 'admin', $1, 1),
           ('Staff User', 'staff@test.local', 'staff', $1, 1)`, [hash]);
  const adminActor = { id: 1, role: 'admin', version: 1 };
  const staffActor = { id: 2, role: 'staff', version: 1 };

  await db.exec(`INSERT INTO categories(name) VALUES ('Test Category');
    INSERT INTO products(id, sku, name, category_id, base_price, current_price, stock)
    VALUES (1, 'PROD-1', 'Product One', 1, 100000, 100000, 5),
           (2, 'PROD-2', 'Product Two', 1, 200000, 200000, 150),
           (3, 'PROD-3', 'Product Three', 1, 50000, 50000, 20);`);

  await t.test('saves pricing rule and recalculates price based on low stock threshold', async () => {
    const res = await savePricingRule(pool, adminActor, 1, {
      lowStock: 10,
      highStock: 50,
      increasePercent: 15,
      discountPercent: 10,
      minPrice: 80000,
      maxPrice: 150000,
      enabled: true
    });
    assert.equal(res.updated, true);
    assert.equal(Number(res.newPrice), 115000);

    const product = (await db.query('SELECT current_price, base_price FROM products WHERE id = 1')).rows[0];
    assert.equal(Number(product.current_price), 115000);
    assert.equal(Number(product.base_price), 100000);

    const history = await pricingRepository.history({ productId: 1 });
    assert.equal(history.length, 1);
    assert.equal(Number(history[0].oldPrice), 100000);
    assert.equal(Number(history[0].newPrice), 115000);
    assert.equal(history[0].reason, 'Cập nhật quy tắc định giá');
    assert.equal(history[0].changedBy, 1);
  });

  await t.test('recalculates high stock discount and clamps to min_price', async () => {
    const res = await savePricingRule(pool, adminActor, 2, {
      lowStock: 20,
      highStock: 100,
      increasePercent: 10,
      discountPercent: 40,
      minPrice: 150000,
      maxPrice: 250000,
      enabled: true
    });
    assert.equal(res.updated, true);
    assert.equal(Number(res.newPrice), 150000);

    const product = (await db.query('SELECT current_price FROM products WHERE id = 2')).rows[0];
    assert.equal(Number(product.current_price), 150000);
  });

  await t.test('clamps to max_price when increase exceeds ceiling', async () => {
    const res = await savePricingRule(pool, adminActor, 1, {
      lowStock: 10,
      highStock: 50,
      increasePercent: 50,
      discountPercent: 10,
      minPrice: 80000,
      maxPrice: 120000,
      enabled: true
    });
    assert.equal(res.updated, true);
    assert.equal(Number(res.newPrice), 120000);
  });

  await t.test('toggle rule off restores base_price and toggle on reapplies rule', async () => {
    const toggledOff = await togglePricingRule(pool, adminActor, 1, false);
    assert.equal(toggledOff.enabled, false);
    assert.equal(toggledOff.updated, true);
    assert.equal(Number(toggledOff.newPrice), 100000);

    const prodOff = (await db.query('SELECT current_price FROM products WHERE id = 1')).rows[0];
    assert.equal(Number(prodOff.current_price), 100000);

    const toggledOn = await togglePricingRule(pool, adminActor, 1, true);
    assert.equal(toggledOn.enabled, true);
    assert.equal(toggledOn.updated, true);
    assert.equal(Number(toggledOn.newPrice), 120000);
  });

  await t.test('repeated recalculation does not compound or create duplicate history', async () => {
    const historyBefore = await pricingRepository.history({ productId: 1 });
    const countBefore = historyBefore.length;

    const res = await recalculateProductPriceManually(pool, adminActor, 1);
    assert.equal(res.updated, false);

    const product = (await db.query('SELECT current_price FROM products WHERE id = 1')).rows[0];
    assert.equal(Number(product.current_price), 120000);

    const historyAfter = await pricingRepository.history({ productId: 1 });
    assert.equal(historyAfter.length, countBefore);
  });

  await t.test('rejects non-admin actor from managing pricing rules', async () => {
    await assert.rejects(
      () => savePricingRule(pool, staffActor, 1, {
        lowStock: 5,
        highStock: 20,
        increasePercent: 10,
        discountPercent: 10,
        minPrice: 50000,
        maxPrice: 200000
      }),
      /Quyền quản trị đã thay đổi/
    );

    await assert.rejects(
      () => togglePricingRule(pool, staffActor, 1, false),
      /Quyền quản trị đã thay đổi/
    );

    await assert.rejects(
      () => recalculateProductPriceManually(pool, staffActor, 1),
      /Quyền quản trị đã thay đổi/
    );
  });

  await t.test('validates pricing rule inputs strictly', async () => {
    await assert.rejects(
      () => savePricingRule(pool, adminActor, 1, {
        lowStock: 20,
        highStock: 10,
        increasePercent: 10,
        discountPercent: 10,
        minPrice: 10000,
        maxPrice: 200000
      }),
      /Ngưỡng tồn cao phải lớn hơn ngưỡng tồn thấp/
    );

    await assert.rejects(
      () => savePricingRule(pool, adminActor, 1, {
        lowStock: 5,
        highStock: 20,
        increasePercent: 10,
        discountPercent: 105,
        minPrice: 10000,
        maxPrice: 200000
      }),
      /Phần trăm giảm giá phải từ 0 đến 100/
    );

    await assert.rejects(
      () => savePricingRule(pool, adminActor, 1, {
        lowStock: 5,
        highStock: 20,
        increasePercent: 10,
        discountPercent: 10,
        minPrice: 200000,
        maxPrice: 100000
      }),
      /Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu/
    );
    const before = await pricingRepository.findRuleByProductId(1);
    for (const enabled of [undefined, null, '', 'yes', 'TRUE', '0', 'false123']) {
      await assert.rejects(() => togglePricingRule(pool, adminActor, 1, enabled), /Trạng thái không hợp lệ/);
      if (enabled !== undefined) await assert.rejects(() => savePricingRule(pool, adminActor, 1, {
        lowStock: 5, highStock: 20, increasePercent: 10, discountPercent: 10, minPrice: 50000, maxPrice: 200000, enabled
      }), /Trạng thái không hợp lệ/);
    }
    assert.deepEqual(await pricingRepository.findRuleByProductId(1), before);
  });

  await t.test('rolls back pricing rule when recalculate price or history fails', async () => {
    await db.query('ALTER TABLE price_history ADD CONSTRAINT test_rollback_constraint CHECK (product_id <> 3)');
    await assert.rejects(
      () => savePricingRule(pool, adminActor, 3, {
        lowStock: 30,
        highStock: 50,
        increasePercent: 20,
        discountPercent: 10,
        minPrice: 30000,
        maxPrice: 80000,
        enabled: true
      }),
      /test_rollback_constraint/
    );
    const rule = (await db.query('SELECT * FROM pricing_rules WHERE product_id = 3')).rows[0];
    assert.equal(rule, undefined);
    await db.query('ALTER TABLE price_history DROP CONSTRAINT test_rollback_constraint');
  });

  await t.test('pricing repository queries return expected structures', async () => {
    const list = await pricingRepository.listRules();
    assert.equal(list.length, 3);
    const rule1 = list.find(item => item.productId === 1);
    assert.equal(rule1.productName, 'Product One');
    assert.equal(rule1.categoryName, 'Test Category');
    assert.equal(rule1.enabled, true);

    const single = await pricingRepository.findRuleByProductId(1);
    assert.equal(single.productId, 1);
    assert.equal(single.ruleId !== null, true);

    const singleNoRule = await pricingRepository.findRuleByProductId(3);
    assert.equal(singleNoRule.productId, 3);
    assert.equal(singleNoRule.ruleId, null);
  });
});

test('pricing routes through authenticated HTTP and PostgreSQL', async t => {
  const db = new PGlite();
  await applySchema(db);
  const pool = createTestPool(db);

  const hash = await hashPassword('Testing@123');
  for (const role of ['admin', 'staff']) {
    await db.query('INSERT INTO users(name, email, role, password_hash) VALUES ($1, $2, $3, $4)',
      [role, `${role}@test.invalid`, role, hash]);
  }
  await db.exec(`INSERT INTO categories(name) VALUES ('Beverages');
    INSERT INTO products(id, sku, name, category_id, base_price, current_price, stock)
    VALUES (1, 'BEV-1', 'Mineral Water', 1, 5000, 5000, 8);`);

  const server = await createApp({ pool });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;

  function client() {
    let cookie = '';
    return async (route, form, options = {}) => {
      const response = await fetch(base + route, {
        method: form ? 'POST' : 'GET',
        redirect: 'manual',
        ...options,
        headers: { cookie, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...options.headers },
        ...(form ? { body: new URLSearchParams(form) } : {})
      });
      if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      const text = await response.text();
      return {
        status: response.status,
        location: response.headers.get('location'),
        allow: response.headers.get('allow'),
        text,
        csrf: text.match(/name="csrf" value="([a-f0-9]+)"/)?.[1]
      };
    };
  }

  const guest = client(), admin = client(), staff = client();
  for (const [request, role] of [[admin, 'admin'], [staff, 'staff']]) {
    const page = await request('/login');
    const login = await request('/login', { csrf: page.csrf, email: `${role}@test.invalid`, password: 'Testing@123' });
    assert.equal(login.status, 303);
  }

  await t.test('blocks unauthenticated and staff users from pricing routes', async () => {
    assert.equal((await guest('/pricing')).location, '/login');
    assert.equal((await guest('/pricing/history')).location, '/login');
    assert.equal((await guest('/pricing/1/edit')).location, '/login');

    assert.equal((await staff('/pricing')).status, 403);
    assert.equal((await staff('/pricing/history')).status, 403);
    assert.equal((await staff('/pricing/1/edit')).status, 403);
    assert.equal((await staff('/pricing/1', { lowStock: 5 })).status, 403);
  });

  await t.test('admin accesses real pricing page and history without placeholder', async () => {
    const page = await admin('/pricing');
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('Quy tắc định giá'));
    assert.ok(!page.text.includes('ĐANG PHÁT TRIỂN'));
    assert.ok(page.text.includes('Mineral Water'));
    assert.ok(page.text.includes('href="/pricing" aria-current="page"'));

    const historyPage = await admin('/pricing/history');
    assert.equal(historyPage.status, 200);
    assert.ok(historyPage.text.includes('Lịch sử biến động giá'));
    assert.ok(!historyPage.text.includes('ĐANG PHÁT TRIỂN'));
  });

  await t.test('saves pricing rule via HTTP POST and applies new price', async () => {
    const editPage = await admin('/pricing/1/edit');
    assert.equal(editPage.status, 200);
    assert.ok(editPage.text.includes('Cấu hình quy tắc định giá'));
    const csrf = editPage.csrf;

    // Reject without CSRF
    const forged = await admin('/pricing/1', { lowStock: '10', highStock: '50', increasePercent: '20', discountPercent: '10', minPrice: '4000', maxPrice: '10000', enabled: 'true' });
    assert.equal(forged.status, 403);

    // Save with CSRF (Stock is 8, low stock threshold is 10 -> price becomes 5,000 * 1.20 = 6,000)
    const saved = await admin('/pricing/1', {
      csrf,
      lowStock: '10',
      highStock: '50',
      increasePercent: '20',
      discountPercent: '10',
      minPrice: '4000',
      maxPrice: '10000',
      enabled: 'true'
    });
    assert.equal(saved.status, 303);
    assert.ok(saved.location.includes('/pricing?saved=rule_saved'));

    const listPage = await admin(saved.location);
    assert.ok(listPage.text.includes('Đã lưu quy tắc định giá'));
    assert.ok(listPage.text.includes('6.000'));

    // Check history updated
    const history = await admin('/pricing/history');
    assert.ok(history.text.includes('Mineral Water'));
    assert.ok(history.text.includes('5.000'));
    assert.ok(history.text.includes('6.000'));
  });

  await t.test('toggles and recalculates pricing rule via HTTP actions', async () => {
    const listPage = await admin('/pricing');
    const csrf = listPage.csrf;

    // Toggle off
    const toggle = await admin('/pricing/1/toggle', { csrf, enabled: 'false' });
    assert.equal(toggle.status, 303);
    assert.ok(toggle.location.includes('/pricing?saved=rule_toggled'));

    const afterToggle = await admin(toggle.location);
    assert.ok(afterToggle.text.includes('Đã cập nhật trạng thái quy tắc'));
    assert.ok(afterToggle.text.includes('5.000')); // restored base price

    // Manual recalculate
    const recalc = await admin('/pricing/1/recalculate', { csrf });
    assert.equal(recalc.status, 303);
    assert.ok(recalc.location.includes('/pricing?saved=recalculated'));
  });

  await t.test('enforces HTTP methods strictly', async () => {
    const del = await admin('/pricing', null, { method: 'DELETE' });
    assert.equal(del.status, 405);
    assert.equal(del.allow, 'GET');
  });

  await t.test('a new rule defaults to enabled and malformed history filters are rejected', async () => {
    await db.exec("INSERT INTO products(id, sku, name, category_id, base_price, current_price) VALUES (2, 'NEW', 'New rule', 1, 999999999999, 999999999999)");
    const form = await admin('/pricing/2/edit');
    assert.equal(form.status, 200);
    assert.ok(form.text.includes('value="true" selected'));
    assert.ok(form.text.includes('id="rule-max-price"'));
    assert.ok(!form.text.includes('value="1499999999999"'));
    assert.equal((await admin('/pricing/history?product_id=not-an-id')).status, 400);
  });

  await t.test('rejects missing CSRF and malformed toggle values without changing prices', async () => {
    const csrf = (await admin('/pricing')).csrf;
    const before = (await db.query('SELECT enabled FROM pricing_rules WHERE product_id=1')).rows[0].enabled;
    assert.equal((await admin('/pricing/1/toggle', { enabled: 'false' })).status, 403);
    assert.equal((await admin('/pricing/1/toggle', { csrf, enabled: 'not-a-state' })).status, 400);
    assert.equal((await db.query('SELECT enabled FROM pricing_rules WHERE product_id=1')).rows[0].enabled, before);
  });

  await t.test('unexpected database errors stay private and roll back rule and price changes', async () => {
    const csrf = (await admin('/pricing')).csrf;
    const beforeProduct = (await db.query('SELECT current_price FROM products WHERE id=1')).rows[0];
    const beforeRule = (await db.query('SELECT * FROM pricing_rules WHERE product_id=1')).rows[0];
    await db.exec('ALTER TABLE price_history ADD CONSTRAINT private_failure_check CHECK (product_id <> 1) NOT VALID');
    try {
      const result = await admin('/pricing/1', { csrf, lowStock: '10', highStock: '100', increasePercent: '50', discountPercent: '10', minPrice: '1000', maxPrice: '10000', enabled: 'true' });
      assert.equal(result.status, 500);
      assert.ok(!result.text.includes('private_failure_check'));
      assert.deepEqual((await db.query('SELECT current_price FROM products WHERE id=1')).rows[0], beforeProduct);
      assert.deepEqual((await db.query('SELECT * FROM pricing_rules WHERE product_id=1')).rows[0], beforeRule);
    } finally {
      await db.exec('ALTER TABLE price_history DROP CONSTRAINT private_failure_check');
    }
  });
});
