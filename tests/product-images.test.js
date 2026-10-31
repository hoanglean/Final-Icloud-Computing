const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const sharp = require('sharp');
const { Readable } = require('node:stream');
const { applySchema } = require('./helpers/schema');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/services/password');
const { sessions } = require('../src/services/session');
const { MAX_IMAGE_BYTES } = require('../src/utils/product-form');
const { createProductRepository } = require('../src/repositories/products');

test('product image uploads, authenticated delivery and transactional replacement', async t => {
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
    for (const role of ['admin', 'staff']) await db.query('INSERT INTO users(name,email,role,password_hash) VALUES ($1,$2,$3,$4)', [role, `${role}@test.invalid`, role, hash]);
    await db.exec("INSERT INTO categories(name) VALUES ('Images'); INSERT INTO products(sku,name,category_id,base_price,current_price) VALUES ('EXISTING','Existing product',1,10000,10000)");
    server = await createApp({ pool });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}`;
    function client() {
      let cookie = '';
      return async (route, body, options = {}) => {
        const multipart = body instanceof FormData;
        const response = await fetch(base + route, {
          method: body ? 'POST' : 'GET', redirect: 'manual', ...options,
          headers: { cookie, ...(body && !multipart ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...options.headers },
          ...(body ? { body: multipart ? body : new URLSearchParams(body) } : {})
        });
        if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        const bytes = Buffer.from(await response.arrayBuffer());
        const text = bytes.toString('utf8');
        return { status: response.status, headers: response.headers, bytes, text, location: response.headers.get('location'), csrf: text.match(/name="csrf" value="([a-f0-9]+)"/)?.[1] };
      };
    }
    const admin = client(), staff = client(), guest = client();
    for (const [request, role] of [[admin,'admin'],[staff,'staff']]) {
      const page = await request('/login');
      assert.equal((await request('/login', { csrf: page.csrf, email: `${role}@test.invalid`, password: 'Testing@123' })).status, 303);
    }
    const csrf = (await admin('/products')).csrf;
    const staffCsrf = (await staff('/products')).csrf;
    const fields = { csrf, name: 'Image product', categoryId: '1', basePrice: '10000' };
    const files = {};
    for (const format of ['png','jpeg','webp']) files[format] = await sharp({ create: { width: 1400, height: 900, channels: 3, background: format === 'jpeg' ? '#b68a25' : '#214e3d' } }).toFormat(format).toBuffer();
    const form = (bytes, format = 'png', values = {}) => {
      const data = new FormData();
      for (const [key, value] of Object.entries({ ...fields, ...values })) data.append(key, value);
      if (bytes !== undefined) data.append('image', new Blob([bytes], { type: `image/${format}` }), `product.${format}`);
      return data;
    };
    const stored = async () => (await db.query('SELECT image_data,base_price,current_price,stock FROM products WHERE id=1')).rows[0];

    await t.test('existing products remain valid with optional image and multipart forms', async () => {
      assert.equal((await stored()).image_data, null);
      const page = await admin('/products/1/edit');
      assert.ok(page.text.includes('enctype="multipart/form-data"'));
      assert.ok(page.text.includes('name="image" type="file"'));
      assert.ok(!page.text.includes('name="removeImage"'));
      assert.equal((await staff('/products/1/image')).status, 404);
    });

    await t.test('creates products from JPG, PNG and WebP, normalizes bytes and limits dimensions', async () => {
      for (const format of ['png','jpeg','webp']) {
        assert.equal((await admin('/products', form(files[format], format, { name: `New ${format}` }))).status, 303);
        const row = (await db.query('SELECT id,stock,image_data FROM products WHERE name=$1', [`New ${format}`])).rows[0];
        assert.equal(row.stock, 0);
        assert.ok(row.image_data.length > 0 && row.image_data.length <= MAX_IMAGE_BYTES);
        const image = await staff(`/products/${row.id}/image`);
        assert.equal(image.status, 200);
        assert.equal(image.headers.get('content-type'), 'image/webp');
        assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
        assert.match(image.headers.get('content-security-policy'), /img-src 'self'/);
        assert.deepEqual(image.bytes, Buffer.from(row.image_data));
        const metadata = await sharp(image.bytes).metadata();
        assert.equal(metadata.format, 'webp');
        assert.ok(metadata.width <= 1200 && metadata.height <= 1200);
        assert.equal(metadata.exif, undefined);
      }
      const rows = await createProductRepository(pool).list();
      assert.ok(rows.filter(row => row.hasImage).length === 3);
      assert.ok(rows.every(row => !Object.hasOwn(row, 'image_data')));
    });

    await t.test('requires admin and CSRF for uploads but allows authenticated staff to view', async () => {
      assert.equal((await guest('/products/1/edit', form(files.png))).location, '/login');
      assert.equal((await guest('/products/2/image')).location, '/login');
      assert.equal((await staff('/products/1/edit', form(files.png, 'png', { csrf: staffCsrf }))).status, 403);
      assert.equal((await admin('/products/1/edit', form(files.png, 'png', { csrf: 'wrong' }))).status, 403);
      assert.equal((await stored()).image_data, null);
      const head = await staff('/products/2/image', undefined, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.bytes.length, 0);
      assert.ok(Number(head.headers.get('content-length')) > 0);
      assert.equal((await admin('/products/2/image', { csrf })).status, 405);
      assert.equal((await staff('/products/abc/image')).status, 400);
      assert.equal((await staff('/products/2147483647/image')).status, 404);
    });

    await t.test('replaces, retains and removes images without changing stock or prices', async () => {
      assert.equal((await admin('/products/1/edit', form(files.png))).status, 303);
      const first = Buffer.from((await stored()).image_data);
      const page = await admin('/products/1/edit');
      assert.ok(page.text.includes('name="removeImage"'));
      assert.ok(page.text.includes('src="/products/1/image"'));
      const keep = form(undefined, 'png', { name: 'Keep current image' });
      keep.append('image', new Blob([]), '');
      assert.equal((await admin('/products/1/edit', keep)).status, 303);
      assert.deepEqual(Buffer.from((await stored()).image_data), first);
      const invalid = await admin('/products/1/edit', form(files.jpeg, 'jpeg', { name: '' }));
      assert.equal(invalid.status, 400);
      assert.ok(invalid.text.includes('src="/products/1/image"'));
      assert.deepEqual(Buffer.from((await stored()).image_data), first);
      assert.equal((await admin('/products/1/edit', form(files.jpeg, 'jpeg'))).status, 303);
      const replaced = await stored();
      assert.notDeepEqual(Buffer.from(replaced.image_data), first);
      assert.equal(Number(replaced.base_price), 10000);
      assert.equal(Number(replaced.current_price), 10000);
      assert.equal(replaced.stock, 0);
      assert.equal((await admin('/products/1/edit', form(files.png, 'png', { removeImage: 'true' }))).status, 400);
      assert.equal((await admin('/products/1/edit', form(undefined, 'png', { removeImage: 'true' }))).status, 303);
      assert.equal((await stored()).image_data, null);
      assert.equal((await staff('/products/1/image')).status, 404);
    });

    await t.test('rejects disguised, broken, empty and oversized uploads without changing the product', async () => {
      for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), Buffer.from('<script>alert(1)</script>'), files.png.subarray(0,8), Buffer.alloc(0)]) {
        assert.equal((await admin('/products/1/edit', form(bytes))).status, 400);
        assert.equal((await stored()).image_data, null);
      }
      assert.equal((await admin('/products/1/edit', form(Buffer.alloc(MAX_IMAGE_BYTES + 1)))).status, 413);
      const tooManyPixels = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: '#214e3d' } }).png().toBuffer();
      assert.ok(tooManyPixels.length < MAX_IMAGE_BYTES);
      assert.equal((await admin('/products/1/edit', form(tooManyPixels))).status, 400);
      const duplicate = form(files.png);
      duplicate.append('image', new Blob([files.png], { type: 'image/png' }), 'second.png');
      assert.equal((await admin('/products/1/edit', duplicate)).status, 400);
      const raw = await fetch(base + '/products/1/edit', { method: 'POST', headers: { 'content-type': 'multipart/form-data' }, body: 'malformed', redirect: 'manual' });
      // Unauthenticated malformed uploads are rejected before parsing.
      assert.equal(raw.status, 303);
      assert.equal((await stored()).image_data, null);
    });

    await t.test('bounds chunked multipart request size and validates malformed multipart bodies', async () => {
      const page = await admin('/products');
      assert.equal((await admin('/products/1/edit', undefined, { method: 'POST', headers: { 'content-type': 'multipart/form-data' }, body: 'malformed' })).status, 400);
      assert.equal((await admin('/products/1/edit', undefined, {
        method: 'POST', duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=boundary' },
        body: Readable.from([Buffer.alloc(MAX_IMAGE_BYTES + 32768)])
      })).status, 413);
      assert.ok(page.csrf);
      assert.equal((await stored()).image_data, null);
    });

    await t.test('rolls back both image and product edits if price history cannot be written', async () => {
      await admin('/products/1/edit', form(files.png));
      const original = Buffer.from((await stored()).image_data);
      await db.exec('CREATE FUNCTION reject_image_price_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION \'test image rollback\'; END $$; CREATE TRIGGER reject_image_price_test BEFORE INSERT ON price_history FOR EACH ROW EXECUTE FUNCTION reject_image_price_test()');
      try {
        assert.equal((await admin('/products/1/edit', form(files.jpeg, 'jpeg', { basePrice: '20000' }))).status, 500);
      } finally {
        await db.exec('DROP TRIGGER reject_image_price_test ON price_history; DROP FUNCTION reject_image_price_test()');
      }
      const retained = await stored();
      assert.deepEqual(Buffer.from(retained.image_data), original);
      assert.equal(Number(retained.base_price), 10000);
      assert.equal(Number(retained.current_price), 10000);
      await assert.rejects(db.query('UPDATE products SET image_data=$1 WHERE id=1', [Buffer.alloc(MAX_IMAGE_BYTES + 1)]), /check constraint/);
    });
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    sessions.clear();
    await db.close();
  }
});
