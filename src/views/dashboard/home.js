const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value || 0));

function homePage(user, stats = null) {
  const admin = user.role === 'admin';

  if (!admin || !stats) {
    return `<main class="workspace">
      <div class="page-title">
        <div>
          <h1>Xin chào, ${escape(user.name)}.</h1>
          <p class="muted">Chúc bạn có một ngày làm việc thuận lợi.</p>
        </div>
        <span class="role-badge">Nhân viên</span>
      </div>
    </main>`;
  }

  const alertRows = (stats.topLowStock || []).map(p => `<tr>
    <th scope="row">
      <span class="category-name">${escape(p.name)}</span>
      <span class="category-id">ID: ${p.id}</span>
    </th>
    <td data-label="Tồn kho" class="num"><strong style="color: var(--color-error);">${p.stock}</strong></td>
    <td data-label="Ngưỡng cảnh báo" class="num">${p.threshold}</td>
    <td data-label="Giá bán" class="num">${money(p.currentPrice)}</td>
    <td data-label="Thao tác"><a class="text-link" href="/inventory/receive">Nhập thêm hàng</a></td>
  </tr>`).join('');

  return `<main class="workspace">
    <div class="page-title">
      <div>
        <h1>Tổng quan cửa hàng</h1>
        <p class="muted">Xin chào, ${escape(user.name)}. Dưới đây là tình hình hoạt động kinh doanh và kho hàng.</p>
      </div>
      <span class="role-badge">Quản trị viên</span>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl);">
      <div class="card">
        <p class="small muted" style="margin: 0 0 var(--space-xs);">Sản phẩm kinh doanh</p>
        <h2 style="margin: 0; font-size: 26px;">${stats.totalProducts} <span class="small" style="font-weight: 400; font-size: 14px;">(${stats.totalStock} tồn)</span></h2>
        <p class="small muted" style="margin-top: var(--space-xs);"><a class="text-link" href="/products">Quản lý sản phẩm &rarr;</a></p>
      </div>

      <div class="card">
        <p class="small muted" style="margin: 0 0 var(--space-xs);">Giá trị vốn tồn kho</p>
        <h2 style="margin: 0; font-size: 26px; color: var(--color-accent);">${money(stats.totalValuation)}</h2>
        <p class="small muted" style="margin-top: var(--space-xs);">Theo giá cơ sở chuẩn</p>
      </div>

      <div class="card">
        <p class="small muted" style="margin: 0 0 var(--space-xs);">Cảnh báo tồn thấp</p>
        <h2 style="margin: 0; font-size: 26px; ${stats.lowStockCount > 0 ? 'color: var(--color-error);' : ''}">${stats.lowStockCount} <span class="small" style="font-weight: 400; font-size: 14px;">sản phẩm</span></h2>
        <p class="small muted" style="margin-top: var(--space-xs);"><a class="text-link" href="/inventory/low-stock">Xem cảnh báo &rarr;</a></p>
      </div>

      <div class="card">
        <p class="small muted" style="margin: 0 0 var(--space-xs);">Doanh thu thuần hôm nay</p>
        <h2 style="margin: 0; font-size: 26px;">${money(stats.todayNetRevenue)}</h2>
        <p class="small muted" style="margin-top: var(--space-xs);">Bán: ${money(stats.todayGrossSales)} &middot; Trả: ${money(stats.todayReturns)}</p>
      </div>
    </div>

    <div class="page-title" style="padding-bottom: var(--space-md); margin-bottom: var(--space-lg); border-bottom: 1px solid var(--color-rule);">
      <div>
        <h2 style="font-size: 20px; margin: 0;">Sản phẩm cần bổ sung hàng</h2>
        <p class="small muted" style="margin: var(--space-2xs) 0 0;">Top sản phẩm có lượng tồn kho dưới ngưỡng an toàn.</p>
      </div>
      <a class="text-link" href="/reports">Xem báo cáo chi tiết &rarr;</a>
    </div>

    ${alertRows.length ? `
      <div class="table-scroll">
        <table class="records-table">
          <caption class="category-sr-only">Sản phẩm sắp hết hàng cần nhập thêm</caption>
          <thead>
            <tr>
              <th scope="col">Sản phẩm</th>
              <th scope="col">Tồn kho hiện tại</th>
              <th scope="col">Ngưỡng cảnh báo</th>
              <th scope="col">Giá bán</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>${alertRows}</tbody>
        </table>
      </div>
    ` : `
      <div class="card" style="padding: var(--space-lg); text-align: center;">
        <p class="muted" style="margin: 0;">Hiện tại tất cả sản phẩm đều đảm bảo lượng tồn kho an toàn.</p>
      </div>
    `}
  </main>`;
}

module.exports = { homePage };
