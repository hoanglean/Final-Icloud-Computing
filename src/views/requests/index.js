const { escape } = require('../../utils/html');

const requestTypes = { RETURN: 'Trả hàng', DAMAGE: 'Hàng hỏng' };
const requestStatuses = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối' };
const time = value => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Saigon', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

function requestFormPage({ type, options, session, isAdmin, values = {}, error = '' }) {
  const isReturn = type === 'RETURN';
  const title = isReturn ? 'Yêu cầu trả hàng' : 'Báo hàng hỏng';
  const action = isReturn ? '/requests/return' : '/requests/damage';
  const referenceLabel = isReturn ? (isAdmin ? 'Giao dịch bán' : 'Giao dịch bán của tôi') : 'Sản phẩm';
  const optionList = isReturn
    ? options.map(sale => `<option value="${sale.saleId}"${String(values.sale_id) === String(sale.saleId) ? ' selected' : ''}>#${sale.saleId} · ${escape(sale.productName)} · Còn trả ${sale.remaining} · ${time(sale.createdAt)}</option>`).join('')
    : options.map(product => `<option value="${product.id}"${String(values.product_id) === String(product.id) ? ' selected' : ''}>${escape(product.name)} · Tồn ${product.stock}</option>`).join('');
  const empty = isReturn ? 'Không còn giao dịch bán nào có thể gửi yêu cầu trả.' : 'Chưa có sản phẩm đang kinh doanh.';
  return `<main class="workspace">
    <div class="page-title"><div><h1>${title}</h1><p class="muted">${isReturn ? 'Chọn giao dịch bán và số lượng cần trả. Tồn kho chỉ thay đổi sau khi được duyệt.' : 'Ghi nhận sản phẩm hỏng. Tồn kho chỉ giảm sau khi quản trị viên duyệt.'}</p></div><a class="text-link" href="/requests">Xem yêu cầu</a></div>
    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}
    ${!options.length ? `<div class="alert error" role="status">${empty}</div>` : ''}
    <form class="management-form card product-form" method="post" action="${action}">
      <input type="hidden" name="csrf" value="${escape(session.csrf)}">
      <div class="form-wide"><label for="request-reference">${referenceLabel}</label><select id="request-reference" name="${isReturn ? 'sale_id' : 'product_id'}" required><option value="">Chọn ${isReturn ? 'giao dịch' : 'sản phẩm'}</option>${optionList}</select></div>
      <div><label for="request-quantity">Số lượng</label><input id="request-quantity" name="quantity" type="number" min="1" max="2147483647" step="1" value="${escape(values.quantity || '')}" required inputmode="numeric"></div>
      <div class="form-wide"><label for="request-reason">Lý do</label><textarea class="stock-note" id="request-reason" name="reason" maxlength="1000" required>${escape(values.reason || '')}</textarea></div>
      <p class="small form-wide">Gửi yêu cầu không làm thay đổi tồn kho hoặc giá bán.</p>
      <div class="form-wide"><button class="button" type="submit"${options.length ? '' : ' disabled'}>Gửi yêu cầu</button></div>
    </form>
  </main>`;
}

function requestsPage(rows, { isAdmin, session, notice = '' }) {
  const entries = rows.map(row => {
    const reviewActions = isAdmin && row.status === 'PENDING' ? `<form method="post" action="/requests/${row.id}/review">
      <input type="hidden" name="csrf" value="${escape(session.csrf)}">
      <label class="category-sr-only" for="review-note-${row.id}">Ghi chú duyệt yêu cầu #${row.id}</label>
      <input id="review-note-${row.id}" name="review_note" maxlength="1000" placeholder="Ghi chú (không bắt buộc)">
      <button class="button" type="submit" name="decision" value="approve" data-confirm="Bạn có chắc chắn muốn DUYỆT yêu cầu #${row.id} không? Thao tác này sẽ cập nhật tồn kho và giá bán.">Duyệt</button>
      <button class="button button-danger" type="submit" name="decision" value="reject" data-confirm="Bạn có chắc chắn muốn TỪ CHỐI yêu cầu #${row.id} không?">Từ chối</button>
    </form>` : '';
    return `<tr>
      <th scope="row">#${row.id}<span class="category-id">${time(row.createdAt)}</span></th>
      <td data-label="Loại">${requestTypes[row.type]}</td>
      <td data-label="Sản phẩm" class="wrap-text">${escape(row.productName)}<span class="category-id">ID: ${row.productId}${row.relatedMovementId ? ` · Bán #${row.relatedMovementId}` : ''}</span></td>
      <td data-label="Số lượng" class="num">${row.quantity}</td>
      <td data-label="Lý do" class="wrap-text multiline-text">${escape(row.reason)}</td>
      ${isAdmin ? `<td data-label="Người gửi" class="wrap-text">${escape(row.requesterName)}</td>` : ''}
      <td data-label="Trạng thái">${requestStatuses[row.status]}</td>
      <td data-label="Xử lý" class="wrap-text">${row.reviewerName ? `${escape(row.reviewerName)}${row.reviewNote ? ` · <span class="multiline-text">${escape(row.reviewNote)}</span>` : ''}` : '—'}${reviewActions}</td>
    </tr>`;
  }).join('');
  return `<main class="workspace"><div class="page-title"><div><h1>${isAdmin ? 'Duyệt yêu cầu' : 'Yêu cầu của tôi'}</h1><p class="muted">${isAdmin ? 'Xem yêu cầu trả hàng, hàng hỏng; duyệt hoặc từ chối mỗi yêu cầu đúng một lần.' : 'Chỉ hiển thị yêu cầu do tài khoản của bạn gửi.'}</p></div></div>
    ${notice ? `<div class="alert success" role="status">${escape(notice)}</div>` : ''}
    ${rows.length ? `<div class="table-scroll"><table class="records-table"><caption class="category-sr-only">${isAdmin ? 'Danh sách yêu cầu chờ xử lý và đã xử lý' : 'Yêu cầu của tôi'}</caption><thead><tr><th scope="col">Mã / thời gian</th><th scope="col">Loại</th><th scope="col">Sản phẩm</th><th scope="col" class="num">Số lượng</th><th scope="col">Lý do</th>${isAdmin ? '<th scope="col">Người gửi</th>' : ''}<th scope="col">Trạng thái</th><th scope="col">Xử lý</th></tr></thead><tbody>${entries}</tbody></table></div>` : '<div class="category-empty"><h2>Chưa có yêu cầu</h2><p>Các yêu cầu trả hàng hoặc hàng hỏng sẽ hiển thị tại đây.</p></div>'}
  </main>`;
}

module.exports = { requestFormPage, requestsPage };
