const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { applySchema } = require('./helpers/schema');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/services/password');
const { createReportsRepository } = require('../src/repositories/reports-postgres');

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

test('dashboard and business reports repository logic', async t => {
  const db = new PGlite();
  await applySchema(db);
  const pool = createTestPool(db);
  const reportsRepository = createReportsRepository(pool);

  const hash = await hashPassword('AdminPass@123');
  await db.query(`INSERT INTO users(name, email, role, password_hash)
    VALUES ('Admin User', 'admin@test.local', 'admin', $1),
           ('Staff User', 'staff@test.local', 'staff', $1)`, [hash]);

  await db.exec(`INSERT INTO categories(name) VALUES ('Category A'), ('Category B');
    INSERT INTO products(id, sku, name, category_id, base_price, current_price, stock)
    VALUES (1, 'P-1', 'Product 1', 1, 10000, 12000, 5),
           (2, 'P-2', 'Product 2', 1, 20000, 20000, 50),
           (3, 'P-3', 'Product 3', 2, 50000, 45000, 2);
    INSERT INTO pricing_rules(product_id, low_stock, high_stock, increase_percent, discount_percent, min_price, max_price)
    VALUES (1, 10, 100, 20, 10, 8000, 15000);`);

  await t.test('calculates correct dashboard summary KPIs', async () => {
    const summary = await reportsRepository.dashboardSummary();
    assert.equal(summary.totalProducts, 3);
    assert.equal(summary.totalStock, 5 + 50 + 2); // 57

    // Base valuation = 5*10000 + 50*20000 + 2*50000 = 50,000 + 1,000,000 + 100,000 = 1,150,000
    assert.equal(Number(summary.totalValuation), 1150000);

    // Low stock products: Product 1 (stock 5 <= low_stock 10) and Product 3 (stock 2 <= default 10) = 2
    assert.equal(summary.lowStockCount, 2);
    assert.equal(summary.topLowStock.length, 2);
  });

  await t.test('calculates net revenue: SALE minus RETURN, excluding DAMAGE and ADJUST', async () => {
    // 1. Staff sells 3 items of Product 1 at 12,000 = 36,000
    const sale1 = (await db.query(`INSERT INTO stock_movements(product_id, type, quantity, unit_price, user_id)
      VALUES (1, 'SALE', 3, 12000, 2) RETURNING id`)).rows[0];

    // 2. Staff sells 2 items of Product 2 at 20,000 = 40,000
    const sale2 = (await db.query(`INSERT INTO stock_movements(product_id, type, quantity, unit_price, user_id)
      VALUES (2, 'SALE', 2, 20000, 2) RETURNING id`)).rows[0];

    // Gross Sales = 36,000 + 40,000 = 76,000

    // 3. Admin receives RETURN of 1 item of Product 1 referencing sale1 = 12,000
    await db.query(`INSERT INTO stock_movements(product_id, type, quantity, unit_price, user_id, related_movement_id)
      VALUES (1, 'RETURN', 1, 12000, 1, $1)`, [sale1.id]);

    // 4. Admin records DAMAGE of Product 3 (must NOT be counted in sales revenue!)
    await db.query(`INSERT INTO stock_movements(product_id, type, quantity, unit_price, user_id, note)
      VALUES (3, 'DAMAGE', 1, 45000, 1, 'Hàng vỡ hỏng')`);

    // 5. Admin records ADJUST_IN and ADJUST_OUT (must NOT be counted in revenue!)
    await db.query(`INSERT INTO stock_movements(product_id, type, quantity, unit_price, user_id, note)
      VALUES (2, 'ADJUST_IN', 10, 20000, 1, 'Kiểm kê thừa')`);
    await db.query(`INSERT INTO stock_movements(product_id, type, quantity, unit_price, user_id, note)
      VALUES (2, 'ADJUST_OUT', 5, 20000, 1, 'Kiểm kê thiếu')`);

    const revenue = await reportsRepository.revenueSummary();
    assert.equal(Number(revenue.grossSales), 76000);
    assert.equal(Number(revenue.returns), 12000);
    assert.equal(Number(revenue.netRevenue), 64000); // 76,000 - 12,000 = 64,000
    assert.equal(revenue.itemsSold, 5); // 3 + 2
    assert.equal(revenue.itemsReturned, 1);
    assert.equal(revenue.salesCount, 2);
    assert.equal(revenue.returnsCount, 1);

    const byCategory = await reportsRepository.revenueByCategory();
    assert.equal(byCategory.length, 1); // Only Category A has sales
    assert.equal(byCategory[0].categoryName, 'Category A');
    assert.equal(Number(byCategory[0].netRevenue), 64000);
  });

  await t.test('handles empty dataset without errors', async () => {
    // Filter for a future date where no movements exist
    const futureDate = '2099-01-01T00:00:00Z';
    const emptySummary = await reportsRepository.revenueSummary({ fromDate: futureDate });
    assert.equal(Number(emptySummary.grossSales), 0);
    assert.equal(Number(emptySummary.returns), 0);
    assert.equal(Number(emptySummary.netRevenue), 0);
    assert.equal(emptySummary.salesCount, 0);

    const emptyCategory = await reportsRepository.revenueByCategory({ fromDate: futureDate });
    assert.equal(emptyCategory.length, 0);

    const emptyFluctuations = await reportsRepository.priceFluctuations({ fromDate: futureDate });
    assert.equal(emptyFluctuations.length, 0);
  });

  await t.test('aggregates price fluctuation frequencies', async () => {
    await db.query(`INSERT INTO price_history(product_id, old_price, new_price, changed_by, reason)
      VALUES (1, 10000, 12000, 1, 'Tăng tồn thấp'),
             (1, 12000, 10000, 1, 'Nhập hàng thêm'),
             (2, 20000, 18000, 1, 'Giảm tồn cao')`);

    const fluctuations = await reportsRepository.priceFluctuations();
    assert.equal(fluctuations.length, 2);
    assert.equal(fluctuations[0].productId, 1);
    assert.equal(fluctuations[0].changeCount, 2);
    assert.equal(Number(fluctuations[0].lowestPrice), 10000);
    assert.equal(Number(fluctuations[0].highestPrice), 12000);

    assert.equal(fluctuations[1].productId, 2);
    assert.equal(fluctuations[1].changeCount, 1);
  });
});

test('dashboard and reports HTTP routes integration', async t => {
  const db = new PGlite();
  await applySchema(db);
  const pool = createTestPool(db);

  const hash = await hashPassword('Testing@123');
  for (const role of ['admin', 'staff']) {
    await db.query('INSERT INTO users(name, email, role, password_hash) VALUES ($1, $2, $3, $4)',
      [role, `${role}@test.invalid`, role, hash]);
  }
  await db.exec(`INSERT INTO categories(name) VALUES ('Test Category');
    INSERT INTO products(id, sku, name, category_id, base_price, current_price, stock)
    VALUES (1, 'P-TEST', 'Demo Product', 1, 15000, 15000, 10);`);

  const server = await createApp({ pool });
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

  await t.test('blocks unauthenticated and staff users from admin dashboard and reports', async () => {
    assert.equal((await guest('/admin')).location, '/login');
    assert.equal((await guest('/reports')).location, '/login');

    assert.equal((await staff('/admin')).status, 403);
    assert.equal((await staff('/reports')).status, 403);
  });

  await t.test('admin accesses real dashboard and reports without placeholder', async () => {
    const adminHome = await admin('/admin');
    assert.equal(adminHome.status, 200);
    assert.ok(adminHome.text.includes('Tổng quan cửa hàng'));
    assert.ok(adminHome.text.includes('Giá trị vốn tồn kho'));
    assert.ok(!adminHome.text.includes('ĐANG PHÁT TRIỂN'));

    const reports = await admin('/reports');
    assert.equal(reports.status, 200);
    assert.ok(reports.text.includes('Báo cáo kinh doanh'));
    assert.ok(reports.text.includes('Doanh thu thuần'));
    assert.ok(!reports.text.includes('ĐANG PHÁT TRIỂN'));
    assert.ok(reports.text.includes('href="/reports" aria-current="page"'));
  });

  await t.test('reports route supports period query filter', async () => {
    const todayReport = await admin('/reports?period=today');
    assert.equal(todayReport.status, 200);
    assert.ok(todayReport.text.includes('Báo cáo kinh doanh'));

    const rangeReport = await admin('/reports?period=custom&from_date=2026-01-01&to_date=2026-12-31');
    assert.equal(rangeReport.status, 200);
    assert.ok(rangeReport.text.includes('2026-01-01'));
  });

  server.close();
});
