const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value));

function pricingRulesPage(products, categoriesOrSession, sessionOrOptions, options = {}) {
  let categories = [];
  let session = {};
  let opts = options;

  if (Array.isArray(categoriesOrSession)) {
    categories = categoriesOrSession;
    session = sessionOrOptions || {};
    opts = options || {};
  } else {
    session = categoriesOrSession || {};
    opts = sessionOrOptions || {};
  }

  const { error = '', notice = '', filters = {} } = opts;
  const { q = '', categoryId = '', ruleStatus = 'all', stockStatus = 'all' } = filters;
  const isFiltered = Boolean(q || categoryId || (ruleStatus && ruleStatus !== 'all') || (stockStatus && stockStatus !== 'all'));

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
            <input type="hidden" name="csrf" value="${escape(session.csrf || '')}">
            <input type="hidden" name="enabled" value="${isEnabled ? 'false' : 'true'}">
            <button class="category-text-button" type="submit">${isEnabled ? 'Tắt quy tắc' : 'Bật quy tắc'}</button>
          </form>` : ''}
          <form method="post" action="/pricing/${item.productId}/recalculate">
            <input type="hidden" name="csrf" value="${escape(session.csrf || '')}">
            <button class="category-text-button" type="submit">Tính lại giá</button>
          </form>
        </div>
      </td>
    </tr>`;
  }).join('');

  const categoryOptions = categories.map(cat =>
    `<option value="${cat.id}"${String(categoryId) === String(cat.id) ? ' selected' : ''}>${escape(cat.name)}</option>`
  ).join('');

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

    <form class="filter-form card" method="get" action="/pricing" style="margin-bottom: var(--space-xl);">
      <div>
        <label for="pricing-search">Tìm theo tên hoặc ID</label>
        <input id="pricing-search" name="q" type="search" maxlength="200" value="${escape(q)}" placeholder="Nhập tên hoặc ID...">
      </div>
      <div>
        <label for="pricing-category">Danh mục</label>
        <select id="pricing-category" name="category">
          <option value="">Tất cả danh mục</option>
          ${categoryOptions}
        </select>
      </div>
      <div>
        <label for="pricing-rule-status">Quy tắc giá</label>
        <select id="pricing-rule-status" name="rule_status">
          <option value="all"${ruleStatus === 'all' ? ' selected' : ''}>Tất cả trạng thái</option>
          <option value="enabled"${ruleStatus === 'enabled' ? ' selected' : ''}>Đang bật quy tắc</option>
          <option value="disabled"${ruleStatus === 'disabled' ? ' selected' : ''}>Đã tắt quy tắc</option>
          <option value="unconfigured"${ruleStatus === 'unconfigured' ? ' selected' : ''}>Chưa cấu hình</option>
        </select>
      </div>
      <div>
        <label for="pricing-stock-status">Tình trạng tồn</label>
        <select id="pricing-stock-status" name="stock_status">
          <option value="all"${stockStatus === 'all' ? ' selected' : ''}>Tất cả mức tồn</option>
          <option value="low"${stockStatus === 'low' ? ' selected' : ''}>Tồn thấp (giá tăng)</option>
          <option value="high"${stockStatus === 'high' ? ' selected' : ''}>Tồn cao (giảm giá)</option>
          <option value="normal"${stockStatus === 'normal' ? ' selected' : ''}>Bình thường</option>
        </select>
      </div>
      <button class="button" type="submit">Lọc sản phẩm</button>
      ${isFiltered ? '<a class="text-link" href="/pricing">Bỏ lọc</a>' : ''}
    </form>

    <p class="small management-note">${products.length} sản phẩm${isFiltered ? ' phù hợp bộ lọc' : ' trong hệ thống'}</p>
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
        <h2>Không có sản phẩm phù hợp</h2>
        <p>${isFiltered ? 'Thử thay đổi điều kiện tìm kiếm hoặc <a class="text-link" href="/pricing">Bỏ lọc</a> để xem tất cả.' : 'Cần tạo sản phẩm trước khi cấu hình quy tắc định giá.'}</p>
      </div>
    `}
  </main>`;
}

module.exports = { pricingRulesPage };

