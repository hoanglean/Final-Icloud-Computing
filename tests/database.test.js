const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applySchema } = require('./helpers/schema');
const { PGlite } = require('@electric-sql/pglite');
const { createPostgresUserRepository } = require('../src/repositories/users-postgres');
const { hashPassword, matches } = require('../src/services/password');

test('PostgreSQL schema and account repository', async t => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await applySchema(db);
    const hash = await hashPassword('Initial@123');
    for (const [name, email, role] of [['Admin', 'admin@test.local', 'admin'], ['Staff', 'staff@test.local', 'staff'], ['Other', 'other@test.local', 'staff']]) {
      await db.query('INSERT INTO users(name, email, role, password_hash) VALUES ($1, $2, $3, $4)', [name, email, role, hash]);
    }
    await db.exec("INSERT INTO categories(name) VALUES ('Demo'); INSERT INTO products(sku, name, category_id, base_price, current_price) VALUES ('DEMO', 'Demo', 1, 100000, 100000);");

    await t.test('rejects invalid inventory, pricing rules and duplicate identities', async () => {
      await assert.rejects(db.exec('UPDATE products SET stock = -1'), /check constraint/);
      await assert.rejects(db.exec("UPDATE products SET base_price = 'NaN'"), /check constraint/);
      await assert.rejects(db.exec("INSERT INTO users(name,email,role,password_hash) VALUES ('X','staff@test.local','staff','hash')"), /unique constraint/);
      await assert.rejects(db.exec('INSERT INTO pricing_rules(product_id,low_stock,high_stock,min_price,max_price) VALUES (1,10,5,100,200)'), /check constraint/);
      await db.exec('INSERT INTO pricing_rules(product_id,low_stock,high_stock,min_price,max_price) VALUES (1,10,100,90000,120000)');
      await assert.rejects(db.exec('INSERT INTO pricing_rules(product_id,low_stock,high_stock,min_price,max_price) VALUES (1,10,100,90000,120000)'), /unique constraint/);
    });

    await t.test('only staff can sell and only admins can receive stock', async () => {
      await assert.rejects(db.exec("INSERT INTO stock_movements(product_id,type,quantity,unit_price,user_id) VALUES (1,'SALE',2,100000,1)"), /Role is not allowed/);
      await assert.rejects(db.exec("INSERT INTO stock_movements(product_id,type,quantity,unit_price,user_id) VALUES (1,'IN',2,100000,2)"), /Role is not allowed/);
      await db.exec("INSERT INTO stock_movements(product_id,type,quantity,unit_price,user_id) VALUES (1,'IN',10,100000,1)");
      await assert.rejects(db.exec("INSERT INTO stock_movements(product_id,type,quantity,unit_price,user_id) VALUES (1,'SALE',0,100000,2)"), /check constraint/);
    });

    const sale = (await db.query("INSERT INTO stock_movements(product_id,type,quantity,unit_price,user_id) VALUES (1,'SALE',3,100000,2) RETURNING id")).rows[0].id;
    await t.test('returns preserve original price, product and total quantity', async () => {
      await assert.rejects(db.query("INSERT INTO stock_movements(product_id,type,quantity,unit_price,user_id,related_movement_id) VALUES (1,'RETURN',1,110000,1,$1)", [sale]), /original sale product and price/);
      await db.query("INSERT INTO stock_movements(product_id,type,quantity,unit_price,user_id,related_movement_id) VALUES (1,'RETURN',2,100000,1,$1)", [sale]);
      await assert.rejects(db.query("INSERT INTO stock_movements(product_id,type,quantity,unit_price,user_id,related_movement_id) VALUES (1,'RETURN',2,100000,1,$1)", [sale]), /exceeds the original sale/);
      await assert.rejects(db.query('DELETE FROM stock_movements WHERE id = $1', [sale]), /immutable/);
      await assert.rejects(db.query('UPDATE stock_movements SET quantity = 100 WHERE id = $1', [sale]), /immutable/);
    });

    await t.test('request review requires admin, a matching movement and a single final decision', async () => {
      await assert.rejects(db.query("INSERT INTO stock_requests(type,product_id,quantity,reason,related_movement_id,requested_by) VALUES ('RETURN',1,1,'Return',$1,3)", [sale]), /their own sales/);
      const request = (await db.query("INSERT INTO stock_requests(type,product_id,quantity,reason,related_movement_id,requested_by) VALUES ('RETURN',1,1,'Return',$1,2) RETURNING id", [sale])).rows[0].id;
      const movement = (await db.query("INSERT INTO stock_movements(product_id,type,quantity,unit_price,user_id,related_movement_id) VALUES (1,'RETURN',1,100000,1,$1) RETURNING id", [sale])).rows[0].id;
      await assert.rejects(db.query("UPDATE stock_requests SET status='APPROVED',reviewed_by=2,reviewed_at=now(),movement_id=$1 WHERE id=$2", [movement, request]), /Only active admins/);
      await assert.rejects(db.query("UPDATE stock_requests SET status='APPROVED',reviewed_by=1,reviewed_at=now(),movement_id=$1 WHERE id=$2", [sale, request]), /match its resulting movement/);
      await db.query("UPDATE stock_requests SET status='APPROVED',reviewed_by=1,reviewed_at=now(),movement_id=$1 WHERE id=$2", [movement, request]);
      await assert.rejects(db.query("UPDATE stock_requests SET status='REJECTED',movement_id=NULL WHERE id=$1", [request]), /only be reviewed once/);
    });

    await t.test('password updates use compare and swap and invalidate previous session versions', async () => {
      const repository = createPostgresUserRepository({ query: async (sql, values) => {
        const result = await db.query(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows };
      } });
      const user = (await repository.all()).find(user => user.id === 2);
      assert.equal(user.isActive, true);
      assert.equal(user.version, 1);
      assert.equal(await matches('Initial@123', user.passwordHash), true);
      const changed = await hashPassword('Changed@456');
      assert.equal(await repository.changePassword(2, user.passwordHash, changed), true);
      assert.equal(await repository.changePassword(2, user.passwordHash, 'stale'), false);
      const updated = (await repository.all()).find(user => user.id === 2);
      assert.equal(updated.version, 2);
      assert.equal(await matches('Changed@456', updated.passwordHash), true);
    });

    await t.test('all business tables use RLS and browser roles cannot read accounts', async () => {
      const result = await db.query("SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'");
      assert.equal(result.rows.length, 7);
      assert.ok(result.rows.every(row => row.relrowsecurity));
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`SET ROLE ${role}`);
        try { await assert.rejects(db.exec('SELECT * FROM public.users'), /permission denied/); }
        finally { await db.exec('RESET ROLE'); }
      }
    });
  } finally { await db.close(); }
});
