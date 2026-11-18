const { stockPicker } = require('../stock-picker');
const { escape } = require('../../utils/html');

const requestTypes = { RETURN: 'Trả hàng', DAMAGE: 'Hàng hỏng' };
const requestStatuses = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối' };
const time = value => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Saigon', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

function requestFormPage({ type, options, session, values = {}, error = '' }) {
  const isReturn = type === 'RETURN';
  const title = isReturn ? 'Yêu cầu trả hàng' : 'Báo hàng hỏng / hết hạn';
  const action = isReturn ? '/requests/return' : '/requests/damage';
  const referenceLabel = isReturn ? 'Giao dịch bán của tôi' : 'Sản phẩm';
  const name = isReturn ? 'sale_id' : 'product_id';
  const items = isReturn
    ? options.map(sale => ({ id: sale.saleId, productId: sale.productId, name: sale.productName, hasImage: sale.hasImage,
      detail: `#${sale.saleId} · ${time(sale.createdAt)}`, limit: `Còn trả: ${sale.remaining}` }))
    : options.map(product => ({ ...product, detail: `ID: ${product.id}`, limit: `Tồn: ${product.stock}` }));
  const empty = isReturn ? 'Không còn giao dịch bán nào có thể gửi yêu cầu trả.' : 'Chưa có sản phẩm đang kinh doanh.';
  return `<main class="workspace">
    <div class="page-title"><div><h1>${title}</h1><p class="muted">${isReturn ? 'Chọn giao dịch bán và số lượng cần trả. Tồn kho chỉ thay đổi sau khi được duyệt.' : 'Ghi nhận sản phẩm hỏng hoặc hết hạn. Tồn kho chỉ giảm sau khi quản trị viên duyệt.'}</p></div><a class="text-link" href="/requests">Xem yêu cầu</a></div>
    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}
    ${!options.length ? `<section class="card"><p>${empty}</p>${isReturn ? '<a class="text-link" href="/sales/history">Xem lịch sử bán của tôi</a>' : ''}</section>` : `<form class="management-form card product-form picker-form" method="post" action="${action}">
      <input type="hidden" name="csrf" value="${escape(session.csrf)}">
      ${items.length ? stockPicker({ label: referenceLabel, name, selected: values[name], items,
        placeholder: isReturn ? 'Nhập tên sản phẩm hoặc mã giao dịch' : undefined }) : ''}
      <div class="picker-fields">
        <h2>Chi tiết yêu cầu</h2>
      ${!isReturn ? `<div><label for="request-condition">Tình trạng hàng</label><select id="request-condition" name="condition"><option value="DAMAGED">Hàng hỏng</option><option value="EXPIRED"${values.condition === 'EXPIRED' ? ' selected' : ''}>Hàng hết hạn</option></select></div>` : ''}
      <div><label for="request-quantity">Số lượng</label><input id="request-quantity" name="quantity" type="number" min="1" max="2147483647" step="1" value="${escape(values.quantity || '')}" required inputmode="numeric"></div>
      <div class="form-wide"><label for="request-reason">Lý do</label><textarea class="stock-note" id="request-reason" name="reason" maxlength="1000" required>${escape(values.reason || '')}</textarea></div>
      <p class="small form-wide">Gửi yêu cầu không làm thay đổi tồn kho hoặc giá bán.</p>
      <div class="form-wide"><button class="button" type="submit"${options.length ? '' : ' disabled'}>Gửi yêu cầu</button></div>
      </div>
    </form>`}
  </main>`;
}

function requestsPage(rows, { isAdmin, session, notice = '' }) {
  const entries = rows.map(row => {
    const reviewActions = isAdmin && row.status === 'PENDING' ? `<form method="post" action="/requests/${row.id}/review">
      <input type="hidden" name="csrf" value="${escape(session.csrf)}">
      <label class="category-sr-only" for="review-note-${row.id}">Ghi chú duyệt yêu cầu #${row.id}</label>
      <input id="review-note-${row.id}" name="review_note" maxlength="1000" placeholder="Ghi chú (không bắt buộc)">
      <div class="review-actions">
        <button class="button" type="submit" name="decision" value="approve" data-confirm="Bạn có chắc chắn muốn DUYỆT yêu cầu #${row.id} không? Thao tác này sẽ cập nhật tồn kho và giá bán.">Duyệt</button>
        <button class="button button-danger" type="submit" name="decision" value="reject" data-confirm="Bạn có chắc chắn muốn TỪ CHỐI yêu cầu #${row.id} không?">Từ chối</button>
      </div>
    </form>` : '';
    return `<tr>
      <th scope="row">#${row.id}<span class="category-id">${time(row.createdAt)}</span></th>
      <td data-label="Loại">${row.type === 'DAMAGE' && row.reason?.startsWith('Hàng hết hạn — ') ? 'Hàng hết hạn' : requestTypes[row.type]}</td>
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
