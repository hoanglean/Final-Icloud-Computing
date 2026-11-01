const { invalid, recordId, text } = require('../utils/validation');
const { applyStockChange } = require('./inventory');

async function createReturnRequest(client, repository, { saleId, quantity, reason, requestedBy, role }) {
  saleId = recordId(saleId, 'Giao dịch bán');
  quantity = recordId(quantity, 'Số lượng');
  reason = text(reason, 'Lý do', 1000);
  requestedBy = recordId(requestedBy, 'Tài khoản');
  const result = await repository.createReturn(client, { saleId, quantity, reason, requestedBy, role });
  if (!result) invalid('Giao dịch bán không tồn tại.', 404);
  if (result.forbidden) invalid('Bạn chỉ được yêu cầu trả hàng từ giao dịch bán của mình.', 403);
  if (result.exceedsLimit) invalid('Tổng số lượng yêu cầu trả vượt số lượng còn có thể trả.', 409);
  return result;
}

async function createDamageRequest(client, repository, { productId, quantity, reason, requestedBy }) {
  productId = recordId(productId, 'Sản phẩm');
  quantity = recordId(quantity, 'Số lượng');
  reason = text(reason, 'Lý do', 1000);
  requestedBy = recordId(requestedBy, 'Tài khoản');
  const result = await repository.createDamage(client, { productId, quantity, reason, requestedBy });
  if (!result) invalid('Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.', 404);
  return result;
}

async function reviewRequest(client, repository, { requestId, decision, reviewedBy, reviewNote = '' }) {
  requestId = recordId(requestId, 'Yêu cầu');
  reviewedBy = recordId(reviewedBy, 'Tài khoản');
  if (!['approve', 'reject'].includes(decision)) invalid('Quyết định duyệt không hợp lệ.');
  reviewNote = reviewNote.trim() ? text(reviewNote, 'Ghi chú duyệt', 1000) : null;

  const request = await repository.findForUpdate(client, requestId);
  if (!request) invalid('Yêu cầu không tồn tại.', 404);
  if (request.status !== 'PENDING') invalid('Yêu cầu đã được xử lý trước đó.', 409);

  let movementId = null;
  const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
  if (decision === 'approve') {
    const movement = await applyStockChange(
      client,
      request.productId,
      request.type,
      request.quantity,
      reviewedBy,
      request.reason,
      request.relatedMovementId
    );
    movementId = movement.id;
  }
  const reviewed = await repository.setReview(client, { id: requestId, status, reviewedBy, reviewNote, movementId });
  if (!reviewed) invalid('Yêu cầu không còn chờ duyệt.', 409);
  return { id: requestId, status, movementId };
}

module.exports = { createReturnRequest, createDamageRequest, reviewRequest };
