const { readForm, redirect, send, json } = require('../utils/http');
const { invalid, text } = require('../utils/validation');
const { escape } = require('../utils/html');
const { transaction } = require('../utils/transaction');
const { createReturnRequest, createDamageRequest, reviewRequest } = require('../services/requests');
const { requestFormPage, requestsPage } = require('../views/requests');

async function requestsRoutes(req, res, { url, user, session, pool, requestRepository }) {
  const reviewMatch = /^\/requests\/([1-9]\d*)\/review$/.exec(url.pathname);
  const routes = ['/requests', '/requests/return', '/requests/damage'];
  if (!routes.includes(url.pathname) && !reviewMatch) return false;
  if (!user) return redirect(res, '/login');
  const isAdmin = user.role === 'admin';
  const respond = (content, status = 200) => send(res, isAdmin ? 'Yêu cầu kho' : 'Yêu cầu của tôi', content, user, session, status, url.pathname);
  const reviewPath = Boolean(reviewMatch);
  if (reviewPath && !isAdmin) return respond('<main class="workspace"><h1>Bạn không có quyền duyệt yêu cầu.</h1><a class="text-link" href="/requests">Về yêu cầu của tôi</a></main>', 403);
  const isReturn = url.pathname === '/requests/return';
  if (isReturn && user.role !== 'staff') return respond('<main class="workspace"><h1>Chỉ nhân viên được gửi yêu cầu trả hàng.</h1><a class="text-link" href="/requests">Về danh sách yêu cầu</a></main>', 403);
  const isForm = isReturn || url.pathname === '/requests/damage';
  if (isForm && !isReturn && user.role !== 'staff') return respond('<main class="workspace"><h1>Chỉ nhân viên được báo hàng hỏng.</h1><a class="text-link" href="/requests">Về danh sách yêu cầu</a></main>', 403);
  const canPost = isForm || reviewPath;
  const allowedMethod = (req.method === 'GET' && !reviewPath) || (req.method === 'POST' && canPost);
  if (!allowedMethod) {
    res.setHeader('Allow', reviewPath ? 'POST' : isForm ? 'GET, POST' : 'GET');
    return respond('<main class="workspace"><h1>Phương thức không được hỗ trợ.</h1></main>', 405);
  }

  const renderForm = async (type, values = {}, error = '', status = 200) => {
    const options = type === 'RETURN'
      ? await requestRepository.returnableSales({ userId: user.id })
      : await requestRepository.activeProducts();
    return respond(requestFormPage({ type, options, session, values, error }), status);
  };

  if (req.method === 'GET') {
    if (isReturn) return renderForm('RETURN');
    if (url.pathname === '/requests/damage') return renderForm('DAMAGE');
    const rows = await requestRepository.list({ userId: isAdmin ? null : user.id });
    if (req.headers.accept?.includes('application/json')) return json(res, rows);
    const saved = url.searchParams.get('saved');
    const notices = {
      created: 'Đã gửi yêu cầu. Tồn kho chưa thay đổi và đang chờ duyệt.',
      approved: 'Đã duyệt yêu cầu và cập nhật giao dịch kho.',
      rejected: 'Đã từ chối yêu cầu. Tồn kho không thay đổi.'
    };
    return respond(requestsPage(rows, { isAdmin, session, notice: Object.hasOwn(notices, saved) ? notices[saved] : '' }));
  }

  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    if (reviewPath) return respond('<main class="workspace"><h1>Biểu mẫu không được hỗ trợ.</h1></main>', 415);
    return renderForm(isReturn ? 'RETURN' : 'DAMAGE', {}, 'Biểu mẫu không được hỗ trợ.', 415);
  }
  const form = await readForm(req);
  if (!form.csrf || form.csrf !== session.csrf) {
    if (reviewPath) return respond('<main class="workspace"><h1>Phiên biểu mẫu không hợp lệ. Hãy tải lại trang và thử lại.</h1></main>', 403);
    return renderForm(isReturn ? 'RETURN' : 'DAMAGE', form, 'Phiên biểu mẫu không hợp lệ. Hãy tải lại trang và thử lại.', 403);
  }

  try {
    if (reviewPath) {
      await transaction(pool, client => reviewRequest(client, requestRepository, {
        requestId: reviewMatch[1],
        decision: form.decision,
        reviewedBy: user.id,
        reviewNote: form.review_note || ''
      }));
      return redirect(res, `/requests?saved=${form.decision === 'approve' ? 'approved' : 'rejected'}`);
    }

    const condition = form.condition || 'DAMAGED';
    if (!isReturn && !['DAMAGED', 'EXPIRED'].includes(condition)) invalid('Tình trạng hàng không hợp lệ.');
    const damageReason = !isReturn && condition === 'EXPIRED' ? `Hàng hết hạn — ${text(form.reason, 'Lý do', 984, { multiline: true })}` : form.reason;
    await transaction(pool, client => isReturn
      ? createReturnRequest(client, requestRepository, {
          saleId: form.sale_id,
          quantity: form.quantity,
          reason: form.reason,
          requestedBy: user.id
        })
      : createDamageRequest(client, requestRepository, {
          productId: form.product_id,
          quantity: form.quantity,
          reason: damageReason,
          requestedBy: user.id
        }));
    return redirect(res, '/requests?saved=created');
  } catch (error) {
    if (error.status) {
      if (reviewPath) return respond(`<main class="workspace"><div class="alert error" role="alert">${escape(error.message)}</div><a class="text-link" href="/requests">Quay lại danh sách yêu cầu</a></main>`, error.status);
      return renderForm(isReturn ? 'RETURN' : 'DAMAGE', form, error.message, error.status);
    }
    throw error;
  }
}

module.exports = { requestsRoutes };
