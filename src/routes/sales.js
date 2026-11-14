const { historyOptions, historyDateRange, loadHistory } = require('../utils/history');
const { readForm, redirect, send, json } = require('../utils/http');
const { transaction } = require('../utils/transaction');
const { applyStockChange } = require('../services/inventory');
const { invalid, recordId } = require('../utils/validation');
const { movementHistoryPage } = require('../views/stock');
const { salePage } = require('../views/stock/sale');

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
  const renderForm = async (quantities = {}, error = '', status = 200) => respond(salePage(await productRepository.list({ status: 'active' }), session, { quantities, error }), status);
  if (req.method === 'GET') {
    if (url.pathname === '/sales') return renderForm();
    const wantsJson = req.headers.accept?.includes('application/json');
    const { period, fromDate, toDate } = historyDateRange(url);
    const filters = { salesOnly: true, userId: adminHistory ? null : user.id, fromDate, toDate };
    const history = await loadHistory(historyOptions(url, wantsJson ? 100 : 20),
      inventoryRepository.countHistory(filters), page => inventoryRepository.history({ ...filters, ...page }));
    if (wantsJson) return json(res, history.rows);
    return respond(movementHistoryPage(history, {
      path: url.pathname, period,
      title: adminHistory ? 'Lịch sử bán hàng nhân viên' : 'Lịch sử bán của tôi',
      salesOnly: true, showUser: adminHistory,
      notice: !adminHistory && url.searchParams.get('saved') === 'sold' ? 'Đã ghi nhận giao dịch bán hàng.' : ''
    }));
  }
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/x-www-form-urlencoded')) return renderForm({}, 'Biểu mẫu không được hỗ trợ.', 415);
  const form = await readForm(req);
  const quantities = Object.fromEntries(Object.entries(form).filter(([key]) => key.startsWith('quantity_')));
  const singleProduct = 'product_id' in form && !Object.keys(quantities).length;
  if (singleProduct) quantities[`quantity_${form.product_id}`] = form.quantity;
  if (!form.csrf || form.csrf !== session.csrf) return renderForm(quantities, 'Phiên biểu mẫu không hợp lệ. Hãy tải lại trang và thử lại.', 403);
  try {
    const lines = [];
    for (const [key, quantity] of Object.entries(quantities)) {
      if (quantity === '' && !singleProduct) continue;
      const id = recordId(key.slice('quantity_'.length), 'Mã sản phẩm');
      lines.push({ id, quantity: recordId(quantity, 'Số lượng') });
    }
    if (!lines.length) invalid('Hãy nhập số lượng cho ít nhất một sản phẩm.');
    // Lock products in the same order when sales overlap.
    lines.sort((a, b) => a.id - b.id);
    await transaction(pool, async client => {
      for (const { id, quantity } of lines) {
        try {
          await applyStockChange(client, id, 'SALE', quantity, user.id);
        } catch (error) {
          if (error.status === 404 || error.status === 409) invalid(`Sản phẩm ID ${id}: ${error.message}`, error.status);
          throw error;
        }
      }
    });
    return redirect(res, '/sales/history?saved=sold');
  } catch (error) {
    if (error.status) return renderForm(quantities, error.message, error.status);
    throw error;
  }
}

module.exports = { salesRoutes };
