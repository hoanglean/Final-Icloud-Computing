const { historyPagination } = require('../history-controls');
const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value));
const time = value => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Saigon', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

function priceHistoryPage(history, products = [], { selectedProduct = null, notice = '' } = {}) {
  const { rows } = history;
  const entries = rows.map(row => {
    const diff = Number(row.newPrice) - Number(row.oldPrice);
    const diffSign = diff > 0 ? `+${money(diff)}` : money(diff);
    const diffBadge = `<span class="category-status${diff > 0 ? '' : ' inactive'}">${diffSign}</span>`;

    return `<tr>
      <th scope="row">${row.id}</th>
      <td data-label="Thời gian">${time(row.createdAt)}</td>
      <td data-label="Sản phẩm" class="wrap-text">
        ${escape(row.productName)}
        <span class="category-id">ID: ${row.productId}</span>
      </td>
      <td data-label="Giá cũ" class="num">${money(row.oldPrice)}</td>
      <td data-label="Giá mới" class="num"><strong>${money(row.newPrice)}</strong></td>
      <td data-label="Biến động">${diffBadge}</td>
      <td data-label="Lý do" class="wrap-text">${escape(row.reason)}</td>
      <td data-label="Người thực hiện" class="wrap-text">${escape(row.userName || 'Hệ thống')}</td>
    </tr>`;
  }).join('');

  return `<main class="workspace">
    <div class="page-title">
      <div>
        <h1>Lịch sử biến động giá</h1>
        <p class="muted">Theo dõi tất cả các lần điều chỉnh giá bán, mức chênh lệch và lý do theo giờ Việt Nam.</p>
      </div>
      <a class="button" href="/pricing">Quản lý quy tắc giá</a>
    </div>

    ${notice ? `<div class="alert success" role="status">${escape(notice)}</div>` : ''}

    <form class="filter-form card history-filters" method="get" action="/pricing/history">
      <div>
        <label for="history-product">Lọc theo sản phẩm</label>
        <select id="history-product" name="product_id">
          <option value="">Tất cả sản phẩm</option>
          ${products.map(p => `<option value="${p.productId || p.id}"${String(selectedProduct) === String(p.productId || p.id) ? ' selected' : ''}>ID ${p.productId || p.id} &middot; ${escape(p.productName || p.name)}</option>`).join('')}
        </select>
      </div>
      <button class="button" type="submit">Áp dụng</button>
      <a class="text-link" href="/pricing/history">Xem tất cả</a>
    </form>

    ${rows.length ? `
      <div class="table-scroll">
        <table class="records-table">
          <caption class="category-sr-only">Lịch sử thay đổi giá bán</caption>
          <thead>
            <tr>
              <th scope="col">Mã</th>
              <th scope="col">Thời gian</th>
              <th scope="col">Sản phẩm</th>
              <th scope="col" class="num">Giá trước</th>
              <th scope="col" class="num">Giá sau</th>
              <th scope="col">Biến động</th>
              <th scope="col">Lý do điều chỉnh</th>
              <th scope="col">Người thực hiện</th>
            </tr>
          </thead>
          <tbody>${entries}</tbody>
        </table>
      </div>
    ` : `
      <div class="category-empty">
        <h2>Chưa có lịch sử thay đổi giá</h2>
        <p>Lịch sử biến động giá sẽ được ghi nhận tại đây khi giá bán của sản phẩm thay đổi.</p>
      </div>
    `}
    ${historyPagination(history, '/pricing/history', selectedProduct ? { product_id: selectedProduct } : {})}
  </main>`;
}

module.exports = { priceHistoryPage };

