const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { applySchema } = require('./helpers/schema');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/services/password');
const { sessions } = require('../src/services/session');
const { transaction } = require('../src/utils/transaction');
const { applyStockChange } = require('../src/services/inventory');

test('return and damaged-stock requests through authenticated HTTP and PostgreSQL', async t => {
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
    for (const [name, role] of [['admin', 'admin'], ['staff', 'staff'], ['other', 'staff']]) {
      await db.query('INSERT INTO users(name,email,role,password_hash) VALUES ($1,$2,$3,$4)', [name, `${name}@test.invalid`, role, hash]);
    }
    await db.exec("INSERT INTO categories(name) VALUES ('Request tests'); INSERT INTO products(sku,name,category_id,base_price,current_price,stock) VALUES ('REQ-1','Tea',1,100000,100000,10),('REQ-2','Coffee',1,200000,200000,2); INSERT INTO pricing_rules(product_id,low_stock,high_stock,increase_percent,discount_percent,min_price,max_price) VALUES (1,8,20,10,10,50000,200000)");
    const sale = await transaction(pool, client => applyStockChange(client, 1, 'SALE', 4, 2));
    const otherSale = await transaction(pool, client => applyStockChange(client, 2, 'SALE', 1, 3));
    server = await createApp({ pool });
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
          text,
          location: response.headers.get('location'),
          type: response.headers.get('content-type'),
          allow: response.headers.get('allow'),
          csrf: text.match(/name="csrf" value="([a-f0-9]+)"/)?.[1]
        };
      };
    }
    const admin = client(), staff = client(), other = client(), guest = client();
    for (const [request, name] of [[admin, 'admin'], [staff, 'staff'], [other, 'other']]) {
      const page = await request('/login');
      assert.equal((await request('/login', { csrf: page.csrf, email: `${name}@test.invalid`, password: 'Testing@123' })).status, 303);
    }
    const adminCsrf = (await admin('/requests')).csrf;
    const staffCsrf = (await staff('/requests/return')).csrf;
    const otherCsrf = (await other('/requests/damage')).csrf;
    const stock = async id => (await db.query('SELECT stock FROM products WHERE id=$1', [id])).rows[0].stock;
    const count = async table => (await db.query(`SELECT count(*)::integer AS total FROM ${table}`)).rows[0].total;
    const list = async request => JSON.parse((await request('/requests', undefined, { headers: { accept: 'application/json' } })).text);
    const approve = (request, csrf, id, fields = {}) => request(`/requests/${id}/review`, { csrf, decision: 'approve', ...fields });
    const reject = (request, csrf, id, fields = {}) => request(`/requests/${id}/review`, { csrf, decision: 'reject', ...fields });
    let returnRequestId, rejectedDamageId, damageRequestId, concurrentDamageId, insufficientDamageId;

    await t.test('renders member-specific forms and protects every request route', async () => {
      for (const request of [admin, staff]) {
        assert.equal((await request('/requests/return')).status, 200);
        assert.equal((await request('/requests/damage')).status, 200);
      }
      assert.equal((await staff('/requests/return')).text.includes(`value="${sale.id}"`), true);
      assert.equal((await staff('/requests/return')).text.includes(`value="${otherSale.id}"`), false);
      assert.equal((await admin('/requests/return')).text.includes(`value="${otherSale.id}"`), true);
      for (const path of ['/requests', '/requests/return', '/requests/damage', `/requests/${sale.id}/review`]) {
        assert.equal((await guest(path)).location, '/login');
      }
      assert.equal((await staff(`/requests/${sale.id}/review`, { csrf: staffCsrf, decision: 'approve' })).status, 403);
      assert.equal((await admin(`/requests/${sale.id}/review`)).status, 405);
      assert.equal((await admin(`/requests/${sale.id}/review`)).allow, 'POST');
      assert.equal((await admin('/requests', { csrf: adminCsrf })).status, 405);
      assert.equal((await admin('/requests/damage', { csrf: adminCsrf }, { headers: { 'content-type': 'application/json' } })).status, 415);
    });

    await t.test('submits pending returns with ownership and quantity reservations without changing stock', async () => {
      const beforeStock = await stock(1);
      const beforeMovements = await count('stock_movements');
      const beforeRequests = await count('stock_requests');
      const invalidCsrf = await staff('/requests/damage', { csrf: 'wrong', product_id: '1', quantity: '1', reason: 'Rejected form' });
      assert.equal(invalidCsrf.status, 403);
      assert.equal(await count('stock_requests'), beforeRequests);
      const response = await staff('/requests/return', {
        csrf: staffCsrf,
        sale_id: String(sale.id),
        quantity: '3',
        reason: '<script>return</script>',
        requested_by: '1',
        product_id: '2'
      });
      assert.equal(response.status, 303);
      assert.equal(response.location, '/requests?saved=created');
      assert.equal(await stock(1), beforeStock);
      assert.equal(await count('stock_movements'), beforeMovements);
      const row = (await db.query('SELECT * FROM stock_requests WHERE type=$1 ORDER BY id DESC LIMIT 1', ['RETURN'])).rows[0];
      returnRequestId = row.id;
      assert.equal(row.product_id, 1);
      assert.equal(row.related_movement_id, sale.id);
      assert.equal(row.requested_by, 2);
      assert.equal(row.status, 'PENDING');

      const overReserved = await staff('/requests/return', { csrf: staffCsrf, sale_id: String(sale.id), quantity: '2', reason: 'Too many' });
      assert.equal(overReserved.status, 409);
      assert.ok(overReserved.text.includes('vượt số lượng còn có thể trả'));
      const otherSaleRequest = await staff('/requests/return', { csrf: staffCsrf, sale_id: String(otherSale.id), quantity: '1', reason: 'Not mine' });
      assert.equal(otherSaleRequest.status, 403);
      assert.equal(await count('stock_requests'), 1);

      const staffRows = await list(staff);
      assert.equal(staffRows.length, 1);
      assert.equal(staffRows[0].requestedBy, 2);
      assert.equal((await list(other)).length, 0);
      const adminRows = await list(admin);
      assert.equal(adminRows.length, 1);
      assert.ok((await staff('/requests')).text.includes('&lt;script&gt;return&lt;/script&gt;'));
    });

    await t.test('approves return atomically at original price and prevents re-review', async () => {
      const beforeMovements = await count('stock_movements');
      const response = await approve(admin, adminCsrf, returnRequestId, { review_note: 'Đã kiểm tra' });
      assert.equal(response.status, 303);
      assert.equal(response.location, '/requests?saved=approved');
      assert.equal(await stock(1), 9);
      assert.equal(await count('stock_movements'), beforeMovements + 1);
      const result = (await db.query('SELECT * FROM stock_requests WHERE id=$1', [returnRequestId])).rows[0];
      assert.equal(result.status, 'APPROVED');
      assert.ok(result.reviewed_at);
      assert.equal(result.reviewed_by, 1);
      const movement = (await db.query('SELECT * FROM stock_movements WHERE id=$1', [result.movement_id])).rows[0];
      assert.equal(movement.type, 'RETURN');
      assert.equal(movement.related_movement_id, sale.id);
      assert.equal(movement.quantity, 3);
      assert.equal(Number(movement.unit_price), 100000);
      assert.equal(Number((await db.query('SELECT current_price FROM products WHERE id=1')).rows[0].current_price), 100000);
      assert.equal((await approve(admin, adminCsrf, returnRequestId)).status, 409);
    });

    await t.test('allows an admin to submit a return request for an employee sale', async () => {
      const beforeStock = await stock(2);
      const created = await admin('/requests/return', { csrf: adminCsrf, sale_id: String(otherSale.id), quantity: '1', reason: 'Admin-assisted return' });
      assert.equal(created.status, 303);
      const row = (await db.query("SELECT * FROM stock_requests WHERE related_movement_id=$1 ORDER BY id DESC LIMIT 1", [otherSale.id])).rows[0];
      assert.equal(row.requested_by, 1);
      assert.equal(row.status, 'PENDING');
      assert.equal(await stock(2), beforeStock);
      assert.equal((await reject(admin, adminCsrf, row.id)).status, 303);
      assert.equal(await stock(2), beforeStock);
    });

    await t.test('rejects damage without changing stock or creating a movement', async () => {
      const beforeStock = await stock(1);
      const beforeMovements = await count('stock_movements');
      const created = await staff('/requests/damage', { csrf: staffCsrf, product_id: '1', quantity: '2', reason: 'Vỏ hộp móp' });
      assert.equal(created.status, 303);
      rejectedDamageId = (await db.query("SELECT id FROM stock_requests WHERE type='DAMAGE' ORDER BY id DESC LIMIT 1")).rows[0].id;
      assert.equal(await stock(1), beforeStock);
      assert.equal(await count('stock_movements'), beforeMovements);
      const rejected = await reject(admin, adminCsrf, rejectedDamageId, { review_note: 'Không đủ căn cứ' });
      assert.equal(rejected.location, '/requests?saved=rejected');
      assert.equal(await stock(1), beforeStock);
      assert.equal(await count('stock_movements'), beforeMovements);
      const row = (await db.query('SELECT status, movement_id, review_note FROM stock_requests WHERE id=$1', [rejectedDamageId])).rows[0];
      assert.equal(row.status, 'REJECTED');
      assert.equal(row.movement_id, null);
      assert.equal(row.review_note, 'Không đủ căn cứ');
    });

    await t.test('rolls back approval when stock is insufficient or request update fails', async () => {
      const notEnough = await staff('/requests/damage', { csrf: staffCsrf, product_id: '2', quantity: '2', reason: 'Hỏng khi kiểm tra' });
      assert.equal(notEnough.status, 303);
      insufficientDamageId = (await db.query("SELECT id FROM stock_requests WHERE product_id=2 ORDER BY id DESC LIMIT 1")).rows[0].id;
      const beforeMovements = await count('stock_movements');
      assert.equal((await approve(admin, adminCsrf, insufficientDamageId)).status, 409);
      assert.equal(await stock(2), 1);
      assert.equal(await count('stock_movements'), beforeMovements);
      assert.equal((await db.query('SELECT status FROM stock_requests WHERE id=$1', [insufficientDamageId])).rows[0].status, 'PENDING');

      const created = await staff('/requests/damage', { csrf: staffCsrf, product_id: '1', quantity: '1', reason: 'Sản phẩm lỗi' });
      assert.equal(created.status, 303);
      damageRequestId = (await db.query("SELECT id FROM stock_requests WHERE type='DAMAGE' AND status='PENDING' ORDER BY id DESC LIMIT 1")).rows[0].id;
      await db.exec("CREATE FUNCTION reject_request_review_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'review write failed'; END $$; CREATE TRIGGER reject_request_review_test BEFORE UPDATE ON stock_requests FOR EACH ROW EXECUTE FUNCTION reject_request_review_test()");
      try {
        assert.equal((await approve(admin, adminCsrf, damageRequestId)).status, 500);
      } finally {
        await db.exec('DROP TRIGGER reject_request_review_test ON stock_requests; DROP FUNCTION reject_request_review_test()');
      }
      assert.equal(await count('stock_movements'), beforeMovements);
      assert.equal((await db.query('SELECT status FROM stock_requests WHERE id=$1', [damageRequestId])).rows[0].status, 'PENDING');
      assert.equal((await stock(1)), 9);
      assert.equal(Number((await db.query('SELECT current_price FROM products WHERE id=1')).rows[0].current_price), 100000);
    });

    await t.test('creates and approves damage once, reducing stock through the shared inventory service', async () => {
      const created = await staff('/requests/damage', { csrf: staffCsrf, product_id: '1', quantity: '1', reason: 'Đã xác nhận hỏng' });
      assert.equal(created.status, 303);
      concurrentDamageId = (await db.query("SELECT id FROM stock_requests WHERE type='DAMAGE' AND status='PENDING' ORDER BY id DESC LIMIT 1")).rows[0].id;
      const beforeMovements = await count('stock_movements');
      const responses = await Promise.all([
        approve(admin, adminCsrf, concurrentDamageId),
        approve(admin, adminCsrf, concurrentDamageId)
      ]);
      assert.deepEqual(responses.map(row => row.status).sort(), [303, 409]);
      assert.equal(await stock(1), 8);
      assert.equal(await count('stock_movements'), beforeMovements + 1);
      const row = (await db.query('SELECT status, movement_id FROM stock_requests WHERE id=$1', [concurrentDamageId])).rows[0];
      assert.equal(row.status, 'APPROVED');
      const movement = (await db.query('SELECT type, quantity, note, user_id FROM stock_movements WHERE id=$1', [row.movement_id])).rows[0];
      assert.equal(movement.type, 'DAMAGE');
      assert.equal(movement.quantity, 1);
      assert.equal(movement.note, 'Đã xác nhận hỏng');
      assert.equal(movement.user_id, 1);
      assert.equal(Number((await db.query('SELECT current_price FROM products WHERE id=1')).rows[0].current_price), 110000);
    });

    await t.test('returns retired products and handles pending damage without reopening sales; reports stay consistent', async () => {
      const jsonOptions = { headers: { accept: 'application/json' } };
      for (const path of ['/admin', '/pricing', '/pricing/history', '/reports']) {
        const page = await admin(path);
        assert.equal(page.status, 200, path);
        assert.ok(!page.text.includes('module-placeholder'), path);
      }
      const previousRevenue = JSON.parse((await admin('/reports', undefined, jsonOptions)).text).summary.netRevenue;
      const product = (await db.query("INSERT INTO products(sku,name,category_id,base_price,current_price,stock) VALUES ('RETIRED','Sản phẩm ngừng bán',1,100000,100000,10) RETURNING id")).rows[0];
      await db.query('INSERT INTO pricing_rules(product_id,low_stock,high_stock,increase_percent,discount_percent,min_price,max_price) VALUES ($1,8,20,10,10,50000,200000)', [product.id]);
      const original = await transaction(pool, client => applyStockChange(client, product.id, 'SALE', 2, 2));
      const reason = 'Khách trả\r\nĐã kiểm tra <script>bad</script>';
      assert.equal((await staff('/requests/return', { csrf: staffCsrf, sale_id: String(original.id), quantity: '1', reason })).status, 303);
      const beforeStopReturn = (await db.query("SELECT id FROM stock_requests WHERE product_id=$1 AND type='RETURN'", [product.id])).rows[0];
      assert.equal((await staff('/requests/damage', { csrf: staffCsrf, product_id: String(product.id), quantity: '1', reason: 'Vỏ hộp vỡ\nĐã xác nhận' })).status, 303);
      const beforeStopDamage = (await db.query("SELECT id FROM stock_requests WHERE product_id=$1 AND type='DAMAGE'", [product.id])).rows[0];
      await db.query('UPDATE products SET is_active=false WHERE id=$1', [product.id]);
      assert.equal((await staff('/requests/return', { csrf: staffCsrf, sale_id: String(original.id), quantity: '1', reason: 'Trả sau ngừng bán\nGiữ giá gốc' })).status, 303);
      const afterStopReturn = (await db.query("SELECT id FROM stock_requests WHERE product_id=$1 AND type='RETURN' AND id<>$2", [product.id, beforeStopReturn.id])).rows[0];
      for (const request of [beforeStopReturn, afterStopReturn, beforeStopDamage]) {
        assert.equal((await approve(admin, adminCsrf, request.id, { review_note: 'Đã kiểm tra\r\nĐồng ý' })).status, 303);
        const reviewed = (await db.query('SELECT status,review_note FROM stock_requests WHERE id=$1', [request.id])).rows[0];
        assert.equal(reviewed.status, 'APPROVED');
        assert.equal(reviewed.review_note, 'Đã kiểm tra\nĐồng ý');
        assert.equal((await approve(admin, adminCsrf, request.id)).status, 409);
      }
      const finalProduct = (await db.query('SELECT stock,is_active,current_price FROM products WHERE id=$1', [product.id])).rows[0];
      assert.equal(finalProduct.stock, 9);
      assert.equal(finalProduct.is_active, false);
      assert.equal(Number(finalProduct.current_price), 100000);
      const returned = (await db.query("SELECT unit_price,note FROM stock_movements WHERE product_id=$1 AND type='RETURN' ORDER BY id", [product.id])).rows;
      assert.equal(returned.length, 2);
      assert.equal(Number(returned[0].unit_price), 100000);
      assert.equal(returned[0].note, reason.replace(/\r\n/g, '\n'));
      const html = await staff('/requests');
      assert.ok(html.text.includes('&lt;script&gt;bad&lt;/script&gt;'));
      const report = JSON.parse((await admin('/reports', undefined, jsonOptions)).text);
      assert.equal(report.summary.netRevenue, previousRevenue);
      const history = JSON.parse((await admin('/pricing/history?product_id=' + product.id, undefined, jsonOptions)).text);
      assert.equal(history.length, 2);
      assert.equal((await staff('/sales', { csrf: staffCsrf, product_id: String(product.id), quantity: '1' })).status, 404);
      assert.equal((await admin('/inventory/receive', { csrf: adminCsrf, product_id: String(product.id), quantity: '1' })).status, 404);
      assert.equal((await staff('/requests/damage', { csrf: staffCsrf, product_id: String(product.id), quantity: '1', reason: 'Không tạo mới cho hàng ngừng bán' })).status, 404);
    });

    await t.test('rejects empty, oversized and control-character reasons while keeping names single-line', async () => {
      const before = await count('stock_requests');
      for (const reason of [' \r\n ', 'x'.repeat(1001), 'Có\u0000lỗi', 'Có\u001blỗi', 'Có\u007flỗi']) {
        assert.equal((await staff('/requests/damage', { csrf: staffCsrf, product_id: '1', quantity: '1', reason })).status, 400);
      }
      assert.equal(await count('stock_requests'), before);
      assert.equal((await admin('/users', { csrf: adminCsrf, name: 'Tên\nkhông hợp lệ', email: 'broken@test.invalid', password: 'Testing@123', role: 'staff' })).status, 400);
    });
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    sessions.clear();
    await db.close();
  }
});
