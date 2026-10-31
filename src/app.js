const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { hashPassword } = require('./services/password');
const { sessions } = require('./services/session');
const { resolveAuth } = require('./middleware/auth');
const { securityHeaders } = require('./middleware/security');
const { authRoutes } = require('./routes/auth');
const { pageRoutes } = require('./routes/pages');
const { createPool } = require('./db');
const { createPostgresUserRepository } = require('./repositories/users-postgres');
const { createCategoryRepository } = require('./repositories/categories');
const { categoryRoutes } = require('./routes/categories');
const { createProductRepository } = require('./repositories/products');
const { productRoutes } = require('./routes/products');
const { userRoutes } = require('./routes/users');
const { createInventoryRepository } = require('./repositories/inventory');
const { inventoryRoutes } = require('./routes/inventory');
const { salesRoutes } = require('./routes/sales');

async function createApp({ pool = createPool() } = {}) {
  const root = path.join(__dirname, '..');
  const userRepository = createPostgresUserRepository(pool);
  const categoryRepository = createCategoryRepository(pool);
  const productRepository = createProductRepository(pool);
  const inventoryRepository = createInventoryRepository(pool);
  try { await userRepository.all(); }
  catch (error) { await pool.end(); throw error; }
  const dummyHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
  const attempts = new Map();
  const cleanup = setInterval(() => {
    for (const [id, s] of sessions) if (s.expires < Date.now()) sessions.delete(id);
    for (const [id, a] of attempts) if (a.until < Date.now()) attempts.delete(id);
  }, 60000);
  cleanup.unref();
  const server = http.createServer(async (req, res) => {
    securityHeaders(res);
    try {
      const url = new URL(req.url, 'http://localhost');
      if (['/style.css', '/tokens.css', '/base.css'].includes(url.pathname) && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
        return res.end(fs.readFileSync(path.join(root, 'public/css', url.pathname.slice(1))));
      }
      const users = await userRepository.all();
      const context = { url, ...resolveAuth(req, res, users), users, userRepository, categoryRepository, productRepository, inventoryRepository, pool, attempts, dummyHash };
      if (url.pathname === '/categories' || url.pathname.startsWith('/categories/')) return await categoryRoutes(req, res, context);
      if (url.pathname === '/products' || url.pathname.startsWith('/products/')) return await productRoutes(req, res, context);
      if (url.pathname === '/users' || url.pathname.startsWith('/users/')) return await userRoutes(req, res, context);
      if (await inventoryRoutes(req, res, context) !== false) return;
      if (await salesRoutes(req, res, context) !== false) return;
      if (req.method === 'POST') return await authRoutes(req, res, context);
      return pageRoutes(req, res, context);
    } catch (error) {
      console.error(error.message);
      if (!res.headersSent) res.writeHead(error.message === 'FORM_TOO_LARGE' ? 413 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Không thể xử lý yêu cầu. Vui lòng thử lại.');
    }
  });
  server.on('close', () => { clearInterval(cleanup); pool.end().catch(() => {}); });
  return server;
}
module.exports = { createApp };
