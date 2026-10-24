const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pageRoutes } = require('../src/routes/pages');
const { layout } = require('../src/views/layout');

const staff = { id: 2, name: 'Nhân viên', role: 'staff' };
const admin = { id: 1, name: 'Quản trị viên', role: 'admin' };
const session = { csrf: 'test-token' };
function visit(path, user) {
  const result = {};
  const res = {
    writeHead(status, headers) { result.status = status; result.headers = headers; },
    end(html) { result.html = html; }
  };
  pageRoutes({ method: 'GET' }, res, { url: new URL(path, 'http://localhost'), user, session });
  return result;
}

test('staff navigation shows daily work and server rejects admin pages', () => {
  const page = visit('/staff', staff);
  assert.equal(page.status, 200);
  for (const path of ['/products', '/inventory/low-stock', '/sales', '/sales/history', '/requests/return', '/requests/damage', '/requests']) {
    assert.ok(page.html.includes(`href="${path}"`), path);
    const module = visit(path, staff);
    assert.equal(module.status, 200, path);
    assert.ok(module.html.includes(`href="${path}" aria-current="page"`), path);
    assert.ok(module.html.includes('ĐANG PHÁT TRIỂN'));
  }
  for (const path of ['/categories', '/inventory/receive', '/inventory/adjust', '/inventory/history', '/admin/sales-history', '/pricing', '/pricing/history', '/reports', '/users']) {
    assert.ok(!page.html.includes(`href="${path}"`), path);
    assert.equal(visit(path, staff).status, 403, path);
    assert.equal(visit(path, admin).status, 200, path);
  }
  assert.ok(page.html.includes('Yêu cầu của tôi'));
  assert.ok(!page.html.includes('Duyệt yêu cầu'));
  assert.ok(!page.html.includes('class="welcome"'));
});

test('admin menu links work and highlight only the selected page', () => {
  const page = visit('/admin', admin);
  assert.ok(page.html.includes('Duyệt yêu cầu'));
  const links = [...page.html.matchAll(/class="sidebar-link[^"]*" href="([^"]+)"/g)];
  assert.equal(links.length, 15);
  for (const [, path] of links) {
    const destination = visit(path, admin);
    assert.equal(destination.status, 200, path);
    assert.equal((destination.html.match(/aria-current="page"/g) || []).length, 1, path);
  }
});

test('admin cannot sell or view personal sales history and sees staff history under management', () => {
  const page = visit('/admin', admin);
  for (const path of ['/sales', '/sales/history']) {
    assert.ok(!page.html.includes(`href="${path}"`));
    assert.equal(visit(path, admin).status, 403);
    assert.equal(visit(path, staff).status, 200);
  }
  assert.ok(!page.html.includes('<h2>Bán hàng</h2>'));
  assert.ok(!page.html.includes('Lịch sử bán của tôi'));
  const management = page.html.match(/<section class="sidebar-group"><h2>Quản trị<\/h2>(.*?)<\/section>/s)?.[1];
  assert.ok(management?.includes('href="/admin/sales-history"'));
  const history = visit('/admin/sales-history', admin);
  assert.equal(history.status, 200);
  assert.ok(history.html.includes('<h1>Lịch sử bán hàng nhân viên</h1>'));
  assert.ok(history.html.includes('Xem lịch sử bán hàng của các nhân viên trong cửa hàng.'));
  assert.equal(visit('/admin/sales-history', staff).status, 403);
});

test('navigation requires login and leaves login page without sidebar', () => {
  for (const path of ['/products', '/users', '/sales', '/requests', '/sales/history', '/admin/sales-history']) {
    const result = visit(path);
    assert.equal(result.status, 303);
    assert.equal(result.headers.Location, '/login');
  }
  assert.ok(!visit('/login').html.includes('class="sidebar"'));
  const html = layout('Test', '', { ...staff, name: '<script>' }, session);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('name="csrf" value="test-token"'));
});
