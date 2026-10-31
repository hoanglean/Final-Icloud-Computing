const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value));
const time = value => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Saigon', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const movementNames = { IN: 'Nhập kho', SALE: 'Bán hàng', RETURN: 'Trả hàng', ADJUST_IN: 'Kiểm kê tăng', ADJUST_OUT: 'Kiểm kê giảm', DAMAGE: 'Hàng hỏng' };

function stockFormPage(products, session, { mode, values = {}, error = '' }) {
  const config = {
    receive: { title: 'Nhập kho', description: 'Ghi nhận số lượng hàng nhập vào cửa hàng.', action: '/inventory/receive', button: 'Nhập kho' },
    adjust: { title: 'Kiểm kê, điều chỉnh', description: 'Ghi nhận chênh lệch số lượng tồn và lý do kiểm kê.', action: '/inventory/adjust', button: 'Lưu điều chỉnh' },
    sale: { title: 'Bán hàng', description: 'Ghi nhận giao dịch theo giá bán và tồn kho tại thời điểm lưu.', action: '/sales', button: 'Ghi nhận bán hàng' }
  }[mode];
  return `<main class="workspace">
    <div class="page-title"><div><h1>${config.title}</h1><p class="muted">${config.description}</p></div><a class="text-link" href="${mode === 'sale' ? '/sales/history' : '/inventory/history'}">Xem lịch sử</a></div>
    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}
    ${!products.length ? '<div class="alert error" role="alert">Chưa có sản phẩm đang kinh doanh. Cần thêm hoặc mở lại sản phẩm trước khi giao dịch.</div>' : ''}
    <form class="management-form card product-form" method="post" action="${config.action}">
      <input type="hidden" name="csrf" value="${escape(session.csrf)}">
      <div class="form-wide"><label for="stock-product">Sản phẩm</label><select id="stock-product" name="product_id" required><option value="">Chọn sản phẩm</option>${products.map(product => `<option value="${product.id}"${String(values.product_id) === String(product.id) ? ' selected' : ''}>ID ${product.id} · ${escape(product.name)} · Tồn ${product.stock} · ${money(product.currentPrice)}</option>`).join('')}</select></div>
      ${mode === 'adjust' ? `<div><label for="stock-type">Hướng điều chỉnh</label><select id="stock-type" name="type" required><option value="">Chọn hướng điều chỉnh</option><option value="ADJUST_IN"${values.type === 'ADJUST_IN' ? ' selected' : ''}>Tăng tồn</option><option value="ADJUST_OUT"${values.type === 'ADJUST_OUT' ? ' selected' : ''}>Giảm tồn</option></select></div>` : ''}
      <div><label for="stock-quantity">Số lượng</label><input id="stock-quantity" name="quantity" type="number" min="1" max="2147483647" step="1" value="${escape(values.quantity || '')}" required inputmode="numeric" aria-describedby="stock-quantity-hint"><p class="small" id="stock-quantity-hint">Nhập số nguyên lớn hơn 0.${mode === 'sale' ? ' Giá và tồn được kiểm tra lại khi lưu.' : ''}</p></div>
      ${mode !== 'sale' ? `<div class="form-wide"><label for="stock-note">${mode === 'adjust' ? 'Lý do kiểm kê' : 'Ghi chú (không bắt buộc)'}</label><textarea class="stock-note" id="stock-note" name="note" maxlength="1000"${mode === 'adjust' ? ' required' : ''}>${escape(values.note || '')}</textarea></div>` : ''}
      <p class="small form-wide">${mode === 'sale' ? 'Giao dịch lưu đơn giá hiện tại. Giá tính lại sau giao dịch áp dụng cho lần bán tiếp theo.' : 'Tồn kho, lịch sử giao dịch và giá bán được cập nhật cùng nhau khi lưu thành công.'}</p>
      <div class="form-wide"><button class="button" type="submit"${products.length ? '' : ' disabled'}>${config.button}</button></div>
    </form></main>`;
}

function movementHistoryPage(rows, { title, salesOnly = false, showUser = true, notice = '' }) {
  const entries = rows.map(row => `<tr>
    <th scope="row">${row.id}</th><td data-label="Thời gian">${time(row.createdAt)}</td>
    <td data-label="Sản phẩm" class="wrap-text">${escape(row.productName)}<span class="category-id">ID: ${row.productId}</span></td>
    ${!salesOnly ? `<td data-label="Loại">${movementNames[row.type] || escape(row.type)}</td>` : ''}
    <td data-label="Số lượng" class="num">${row.quantity}</td><td data-label="Đơn giá" class="num">${money(row.unitPrice)}</td>
    ${showUser ? `<td data-label="Người thực hiện" class="wrap-text">${escape(row.userName)}</td>` : ''}
    ${!salesOnly ? `<td data-label="Ghi chú" class="wrap-text">${escape(row.note || '—')}</td>` : ''}
  </tr>`).join('');
  return `<main class="workspace"><div class="page-title"><div><h1>${title}</h1><p class="muted">Hiển thị tối đa 100 giao dịch gần nhất${salesOnly && !showUser ? ' do bạn thực hiện' : ''}. Thời gian theo giờ Việt Nam.</p></div></div>
    ${notice ? `<div class="alert success" role="status">${escape(notice)}</div>` : ''}
    ${rows.length ? `<div class="table-scroll"><table class="records-table"><caption class="category-sr-only">${title}</caption><thead><tr><th scope="col">Mã</th><th scope="col">Thời gian</th><th scope="col">Sản phẩm</th>${!salesOnly ? '<th scope="col">Loại</th>' : ''}<th scope="col">Số lượng</th><th scope="col">Đơn giá</th>${showUser ? '<th scope="col">Người thực hiện</th>' : ''}${!salesOnly ? '<th scope="col">Ghi chú</th>' : ''}</tr></thead><tbody>${entries}</tbody></table></div>` : '<div class="category-empty"><h2>Chưa có giao dịch</h2><p>Giao dịch sẽ xuất hiện tại đây sau khi được ghi nhận thành công.</p></div>'}</main>`;
}

function lowStockPage(products) {
  return `<main class="workspace"><div class="page-title"><div><h1>Cảnh báo tồn thấp</h1><p class="muted">Các sản phẩm đang kinh doanh cần bổ sung hàng theo ngưỡng tồn đã cấu hình.</p></div><span class="role-badge">${products.length} sản phẩm</span></div>
    ${products.length ? `<table class="records-table"><caption class="category-sr-only">Sản phẩm tồn thấp</caption><thead><tr><th scope="col">Sản phẩm</th><th scope="col">Tồn kho</th><th scope="col">Giá bán</th></tr></thead><tbody>${products.map(product => `<tr><th scope="row">${escape(product.name)}<span class="category-id">ID: ${product.id}</span></th><td data-label="Tồn kho" class="num">${product.stock}</td><td data-label="Giá bán" class="num">${money(product.currentPrice)}</td></tr>`).join('')}</tbody></table>` : '<div class="category-empty"><h2>Không có sản phẩm tồn thấp</h2><p>Chưa có sản phẩm cần bổ sung hàng theo ngưỡng hiện tại.</p></div>'}</main>`;
}

module.exports = { stockFormPage, movementHistoryPage, lowStockPage };
