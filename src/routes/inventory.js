const { readForm, redirect, send, json } = require('../utils/http');
const { invalid } = require('../utils/validation');
const { transaction } = require('../utils/transaction');
const { applyStockChange } = require('../services/inventory');
const { stockFormPage, movementHistoryPage, lowStockPage } = require('../views/stock');

async function inventoryRoutes(req, res, { url, user, session, productRepository, inventoryRepository, pool }) {
  const paths = ['/inventory/receive', '/inventory/adjust', '/inventory/history', '/inventory/low-stock'];
  if (!paths.includes(url.pathname)) return false;
  if (!user) return redirect(res, '/login');
  const respond = (content, status = 200) => send(res, 'Kho hàng', content, user, session, status, url.pathname);
  if (url.pathname !== '/inventory/low-stock' && user.role !== 'admin') return respond('<main class="workspace"><h1>Bạn không có quyền quản lý kho.</h1><a class="text-link" href="/products">Về sản phẩm</a></main>', 403);
  const formPage = ['/inventory/receive', '/inventory/adjust'].includes(url.pathname);
  if (req.method !== 'GET' && !(formPage && req.method === 'POST')) {
    res.setHeader('Allow', formPage ? 'GET, POST' : 'GET');
    return respond('<main class="workspace"><h1>Phương thức không được hỗ trợ.</h1></main>', 405);
  }
  const mode = url.pathname === '/inventory/receive' ? 'receive' : 'adjust';
  const renderForm = async (values = {}, error = '', status = 200) => respond(stockFormPage(await productRepository.list({ status: 'active' }), session, { mode, values, error }), status);
  if (req.method === 'GET') {
    if (formPage) return renderForm();
    const lowStock = url.pathname === '/inventory/low-stock';
    const rows = lowStock ? await inventoryRepository.lowStock() : await inventoryRepository.history();
    if (req.headers.accept?.includes('application/json')) return json(res, rows);
    const notices = { receive: 'Đã nhập kho và cập nhật giá bán theo quy tắc hiện tại.', adjust: 'Đã ghi nhận kiểm kê và cập nhật giá bán theo quy tắc hiện tại.' };
    const saved = url.searchParams.get('saved');
    return respond(lowStock ? lowStockPage(rows) : movementHistoryPage(rows, { title: 'Lịch sử kho', notice: Object.hasOwn(notices, saved) ? notices[saved] : '' }));
  }
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/x-www-form-urlencoded')) return renderForm({}, 'Biểu mẫu không được hỗ trợ.', 415);
  const form = await readForm(req);
  if (!form.csrf || form.csrf !== session.csrf) return renderForm(form, 'Phiên biểu mẫu không hợp lệ. Hãy tải lại trang và thử lại.', 403);
  try {
    const type = mode === 'receive' ? 'IN' : form.type;
    if (mode === 'adjust' && !['ADJUST_IN', 'ADJUST_OUT'].includes(type)) invalid('Kiểm kê chỉ cho phép tăng hoặc giảm tồn.');
    await transaction(pool, client => applyStockChange(client, form.product_id, type, form.quantity, user.id, form.note));
    return redirect(res, `/inventory/history?saved=${mode}`);
  } catch (error) {
    if (error.status) return renderForm(form, error.message, error.status);
    throw error;
  }
}

module.exports = { inventoryRoutes };
