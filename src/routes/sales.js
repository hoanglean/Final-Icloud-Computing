const { readForm, redirect, send, json } = require('../utils/http');
const { transaction } = require('../utils/transaction');
const { applyStockChange } = require('../services/inventory');
const { stockFormPage, movementHistoryPage } = require('../views/stock');

async function salesRoutes(req, res, { url, user, session, pool, productRepository, inventoryRepository }) {
  if (!['/sales', '/sales/history', '/admin/sales-history'].includes(url.pathname)) return false;
  if (!user) return redirect(res, '/login');
  const respond = (content, status = 200) => send(res, 'Bán hàng', content, user, session, status, url.pathname);
  const adminHistory = url.pathname === '/admin/sales-history';
  if (user.role !== (adminHistory ? 'admin' : 'staff')) return respond('<main class="workspace"><h1>Bạn không có quyền sử dụng chức năng này.</h1><a class="text-link" href="/products">Về sản phẩm</a></main>', 403);
  if (req.method !== 'GET' && !(url.pathname === '/sales' && req.method === 'POST')) {
    res.setHeader('Allow', url.pathname === '/sales' ? 'GET, POST' : 'GET');
    return respond('<main class="workspace"><h1>Phương thức không được hỗ trợ.</h1></main>', 405);
  }
  const renderForm = async (values = {}, error = '', status = 200) => respond(stockFormPage(await productRepository.list({ status: 'active' }), session, { mode: 'sale', values, error }), status);
  if (req.method === 'GET') {
    if (url.pathname === '/sales') return renderForm();
    const rows = await inventoryRepository.history({ salesOnly: true, userId: adminHistory ? null : user.id });
    if (req.headers.accept?.includes('application/json')) return json(res, rows);
    return respond(movementHistoryPage(rows, {
      title: adminHistory ? 'Lịch sử bán hàng nhân viên' : 'Lịch sử bán của tôi',
      salesOnly: true, showUser: adminHistory,
      notice: !adminHistory && url.searchParams.get('saved') === 'sold' ? 'Đã ghi nhận giao dịch bán hàng.' : ''
    }));
  }
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/x-www-form-urlencoded')) return renderForm({}, 'Biểu mẫu không được hỗ trợ.', 415);
  const form = await readForm(req);
  if (!form.csrf || form.csrf !== session.csrf) return renderForm(form, 'Phiên biểu mẫu không hợp lệ. Hãy tải lại trang và thử lại.', 403);
  try {
    await transaction(pool, client => applyStockChange(client, form.product_id, 'SALE', form.quantity, user.id));
    return redirect(res, '/sales/history?saved=sold');
  } catch (error) {
    if (error.status) return renderForm(form, error.message, error.status);
    throw error;
  }
}

module.exports = { salesRoutes };
