const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value));

function pricingRulesPage(products, session, { error = '', notice = '' } = {}) {
  const rows = products.map(item => {
    const hasRule = item.ruleId !== null && item.ruleId !== undefined;
    const isEnabled = hasRule && Boolean(item.enabled);
    const ruleSummary = hasRule
      ? `<div class="small">
          <div>Tồn &le; <strong>${item.lowStock}</strong>: +${item.increasePercent}%</div>
          <div>Tồn &ge; <strong>${item.highStock}</strong>: -${item.discountPercent}%</div>
          <div class="muted">[${money(item.minPrice)} &mdash; ${money(item.maxPrice)}]</div>
        </div>`
      : '<span class="muted small">Chưa cấu hình (giữ giá cơ sở)</span>';

    const statusBadge = hasRule
      ? `<span class="category-status${isEnabled ? '' : ' inactive'}">${isEnabled ? 'Đang bật' : 'Đã tắt'}</span>`
      : '<span class="category-status inactive">Chưa có</span>';

    return `<tr>
      <th scope="row">
        <div>
          <span class="category-name">${escape(item.productName)}</span>
          <span class="category-id">ID: ${item.productId} &middot; ${escape(item.categoryName)}</span>
        </div>
      </th>
      <td class="num" data-label="Tồn kho">${item.stock}</td>
      <td class="num" data-label="Giá cơ sở">${money(item.basePrice)}</td>
      <td class="num" data-label="Giá hiện tại"><strong>${money(item.currentPrice)}</strong></td>
      <td data-label="Quy tắc">${ruleSummary}</td>
      <td data-label="Trạng thái">${statusBadge}</td>
      <td data-label="Thao tác">
        <div class="category-actions">
          <a class="text-link" href="/pricing/${item.productId}/edit">${hasRule ? 'Sửa quy tắc' : 'Thêm quy tắc'}</a>
          ${hasRule ? `<form method="post" action="/pricing/${item.productId}/toggle">
            <input type="hidden" name="csrf" value="${escape(session.csrf)}">
            <input type="hidden" name="enabled" value="${isEnabled ? 'false' : 'true'}">
            <button class="category-text-button" type="submit">${isEnabled ? 'Tắt quy tắc' : 'Bật quy tắc'}</button>
          </form>` : ''}
          <form method="post" action="/pricing/${item.productId}/recalculate">
            <input type="hidden" name="csrf" value="${escape(session.csrf)}">
            <button class="category-text-button" type="submit">Tính lại giá</button>
          </form>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `<main class="workspace">
    <div class="page-title">
      <div>
        <h1>Quy tắc định giá</h1>
        <p class="muted">Cấu hình ngưỡng tồn kho, tỷ lệ tăng giảm giá tự động và tính lại giá cho từng sản phẩm.</p>
      </div>
      <a class="button" href="/pricing/history">Xem lịch sử giá</a>
    </div>
    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}
    ${notice ? `<div class="alert success" role="status">${escape(notice)}</div>` : ''}
    <p class="small management-note">${products.length} sản phẩm trong hệ thống</p>
    ${products.length ? `
      <div class="table-scroll">
        <table class="records-table">
          <caption class="category-sr-only">Danh sách quy tắc định giá động theo sản phẩm</caption>
          <thead>
            <tr>
              <th scope="col">Sản phẩm</th>
              <th scope="col">Tồn kho</th>
              <th scope="col">Giá cơ sở</th>
              <th scope="col">Giá bán hiện tại</th>
              <th scope="col">Quy tắc định giá</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    ` : `
      <div class="category-empty">
        <h2>Chưa có sản phẩm</h2>
        <p>Cần tạo sản phẩm trước khi cấu hình quy tắc định giá.</p>
      </div>
    `}
  </main>`;
}

module.exports = { pricingRulesPage };

