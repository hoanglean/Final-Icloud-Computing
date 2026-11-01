const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(value || 0);

function homePage(user, stats = null) {
  const admin = user.role === 'admin';

  if (!admin || !stats) {
    return `<main class="workspace">
      <div class="page-title">
        <div>
          <h1>Xin chào, ${escape(user.name)}.</h1>
          <p class="muted">Chúc bạn có một ngày làm việc thuận lợi.</p>
        </div>
      <span class="role-badge">${admin ? 'Quản trị viên' : 'Nhân viên'}</span>
      </div>
    </main>`;
  }

  const alertRows = (stats.topLowStock || []).map(p => `<tr>
    <th scope="row">
      <span class="category-name">${escape(p.name)}</span>
      <span class="category-id">ID: ${p.id}</span>
    </th>
    <td data-label="Tồn kho" class="num metric-error"><strong>${p.stock}</strong></td>
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

    <div class="metrics-grid">
      <div class="card">
        <p class="small muted metric-label">Sản phẩm kinh doanh</p>
        <h2 class="metric-value">${stats.totalProducts} <span class="metric-unit">(${stats.totalStock} tồn)</span></h2>
        <p class="small muted metric-note"><a class="text-link" href="/products">Quản lý sản phẩm &rarr;</a></p>
      </div>

      <div class="card">
        <p class="small muted metric-label">Giá trị vốn tồn kho</p>
        <h2 class="metric-value metric-accent">${money(stats.totalValuation)}</h2>
        <p class="small muted metric-note">Theo giá cơ sở chuẩn</p>
      </div>

      <div class="card">
        <p class="small muted metric-label">Cảnh báo tồn thấp</p>
        <h2 class="metric-value${stats.lowStockCount > 0 ? ' metric-error' : ''}">${stats.lowStockCount} <span class="metric-unit">sản phẩm</span></h2>
        <p class="small muted metric-note"><a class="text-link" href="/inventory/low-stock">Xem cảnh báo &rarr;</a></p>
      </div>

      <div class="card">
        <p class="small muted metric-label">Doanh thu thuần hôm nay</p>
        <h2 class="metric-value">${money(stats.todayNetRevenue)}</h2>
        <p class="small muted metric-note">Bán: ${money(stats.todayGrossSales)} &middot; Trả: ${money(stats.todayReturns)}</p>
      </div>
    </div>

    <div class="page-title report-section-title">
      <div>
        <h2>Sản phẩm cần bổ sung hàng</h2>
        <p class="small muted">Top sản phẩm có lượng tồn kho dưới ngưỡng an toàn.</p>
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
      <div class="card report-empty">
        <p class="muted">Hiện tại tất cả sản phẩm đều đảm bảo lượng tồn kho an toàn.</p>
      </div>
    `}
  </main>`;
}

module.exports = { homePage };
