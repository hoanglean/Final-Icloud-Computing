const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(value || 0);
const count = value => new Intl.NumberFormat('vi-VN').format(value || 0);
const paths = {
  box: 'm3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7 5l10 5',
  in: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  cart: 'M2 3h3l3 12h11l3-9H6M9 20h.01M18 20h.01',
  chart: 'M4 3v18h17M8 16v-5m5 5V7m5 9v-8',
  alert: 'm12 3 10 18H2L12 3Zm0 6v5m0 3v1',
  return: 'M8 4 3 9l5 5M3 9h12a6 6 0 0 1 0 12h-4',
  check: 'M9 4H5v17h14V4h-4M9 2h6v5H9V2Zm-1 12 3 3 5-6',
  history: 'M3 4v5h5M3 9a9 9 0 1 1 0 7M12 7v5l3 2',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  tag: 'M3 3h9l9 9-9 9-9-9V3Zm5 5h.01'
};
const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"></path></svg>`;

function revenueChart(categories) {
  if (!categories.length) return `<div class="overview-empty">${icon('chart')}<h3>Chưa có dữ liệu doanh thu</h3><p>Biểu đồ sẽ xuất hiện khi có giao dịch bán hàng hoặc trả hàng được duyệt.</p><a class="text-link" href="/reports">Mở báo cáo kinh doanh ${icon('arrow')}</a></div>`;
  const shown = categories.slice(0, 6);
  const values = shown.map(row => Number(row.netRevenue));
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = value => 178 + (value - min) / span * 360;
  const zero = x(0);
  const height = 52 + shown.length * 46;
  const compact = value => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const bars = shown.map((row, index) => {
    const value = values[index], y = 34 + index * 46;
    const label = [...row.categoryName].length > 25 ? [...row.categoryName].slice(0, 24).join('') + '…' : row.categoryName;
    return `<g><title>${escape(row.categoryName)}: ${money(row.netRevenue)}</title><text class="chart-category" x="0" y="${y + 15}">${escape(label)}</text>${value === 0 ? `<circle class="chart-bar" cx="${zero.toFixed(2)}" cy="${y + 11}" r="3"></circle>` : `<rect class="chart-bar${value < 0 ? ' chart-bar-negative' : ''}" x="${Math.min(x(value), zero).toFixed(2)}" y="${y}" width="${Math.abs(x(value) - zero).toFixed(2)}" height="22" rx="4"></rect>`}<text class="chart-amount" x="694" y="${y + 15}" text-anchor="end">${money(row.netRevenue)}</text></g>`;
  }).join('');
  return `<div class="overview-chart"><svg viewBox="0 0 700 ${height}" role="img" aria-label="Doanh thu thuần theo danh mục, tính từ toàn bộ giao dịch bán và trả hàng"><line class="chart-grid-line" x1="178" y1="25" x2="178" y2="${height - 26}"></line><line class="chart-grid-line" x1="358" y1="25" x2="358" y2="${height - 26}"></line><line class="chart-grid-line" x1="538" y1="25" x2="538" y2="${height - 26}"></line><line class="chart-zero-line" x1="${zero.toFixed(2)}" y1="25" x2="${zero.toFixed(2)}" y2="${height - 26}"></line>${bars}<text class="chart-axis" x="178" y="${height - 4}">${compact(min)}</text><text class="chart-axis" x="538" y="${height - 4}" text-anchor="end">${compact(max)}</text><text class="chart-axis" x="694" y="${height - 4}" text-anchor="end">Đơn vị: đồng</text></svg></div>
    <p class="chart-caption">${categories.length > 6 ? '6 danh mục có doanh thu thuần cao nhất. ' : ''}Doanh thu thuần = doanh số bán − giá trị hàng trả.</p>
    <details class="chart-data"><summary>Xem số liệu chi tiết</summary><div class="table-scroll"><table class="records-table"><caption class="category-sr-only">Doanh thu theo toàn bộ danh mục</caption><thead><tr><th>Danh mục</th><th class="num">Doanh số bán</th><th class="num">Hàng trả</th><th class="num">Doanh thu thuần</th></tr></thead><tbody>${categories.map(row => `<tr><th scope="row">${escape(row.categoryName)}</th><td class="num" data-label="Doanh số bán">${money(row.grossSales)}</td><td class="num" data-label="Hàng trả">${money(row.returns)}</td><td class="num" data-label="Doanh thu thuần">${money(row.netRevenue)}</td></tr>`).join('')}</tbody></table></div></details>`;
}

function staffHome(user) {
  const actions = [
    ['/sales', 'cart', 'Bán hàng', 'Ghi nhận giao dịch và cập nhật tồn kho.', ' action-featured'],
    ['/products', 'box', 'Tra cứu sản phẩm', 'Xem giá bán, hình ảnh và số lượng còn lại.', ''],
    ['/sales/history', 'history', 'Lịch sử bán của tôi', 'Tra cứu các giao dịch bạn đã thực hiện.', '']
  ];
  const requests = [
    ['/requests/return', 'return', 'Yêu cầu trả hàng', 'Chọn giao dịch gốc và gửi yêu cầu hoàn trả.'],
    ['/requests/damage', 'alert', 'Báo hàng hỏng', 'Ghi nhận sản phẩm hỏng để quản trị viên xử lý.'],
    ['/requests', 'check', 'Yêu cầu của tôi', 'Theo dõi kết quả duyệt và ghi chú phản hồi.']
  ];
  return `<main class="workspace staff-workspace"><div class="page-title"><div><p class="page-eyebrow">KHÔNG GIAN LÀM VIỆC</p><h1>Xin chào, ${escape(user.name)}.</h1><p class="muted">Chọn công việc bạn muốn thực hiện để bắt đầu.</p></div><span class="role-badge">Nhân viên</span></div>
    <div class="section-heading"><div><h2>Thao tác thường dùng</h2><p>Các chức năng phục vụ bán hàng hằng ngày.</p></div></div>
    <div class="staff-actions">${actions.map(([url, symbol, title, description, style]) => `<a class="staff-action${style}" href="${url}"><span class="action-icon">${icon(symbol)}</span><h2>${title}</h2><p>${description}</p><span class="action-open">Mở chức năng ${icon('arrow')}</span></a>`).join('')}</div>
    <section class="overview-panel staff-requests"><div class="section-heading"><div><h2>Trả hàng và hỗ trợ kho</h2><p>Gửi và theo dõi các yêu cầu cần quản trị viên xem xét.</p></div></div><div class="staff-request-grid">${requests.map(([url, symbol, title, description]) => `<a class="staff-request" href="${url}"><span class="action-icon">${icon(symbol)}</span><div><h3>${title}</h3><p>${description}</p></div>${icon('arrow')}</a>`).join('')}</div></section>
    <a class="staff-stock-link" href="/inventory/low-stock">${icon('alert')}Kiểm tra sản phẩm sắp hết hàng<span>Xem cảnh báo ${icon('arrow')}</span></a>
  </main>`;
}

function homePage(user, stats = null) {
  if (user.role !== 'admin') return staffHome(user);
  if (!stats) return `<main class="workspace"><div class="page-title"><div><h1>Tổng quan cửa hàng</h1><p class="muted">Xin chào, ${escape(user.name)}.</p></div></div></main>`;
  const pending = stats.pendingRequests || 0;
  const metrics = [
    ['in', 'Tổng lượng nhập', count(stats.totalReceived), 'đơn vị', `${count(stats.receiptCount)} lượt nhập kho`, '/inventory/history'],
    ['cart', 'Tổng lượng bán', count(stats.totalSold), 'đơn vị', `${count(stats.saleCount)} lượt bán · Đã trả ${count(stats.totalReturned)} đơn vị`, '/admin/sales-history'],
    ['chart', 'Doanh thu thuần', money(stats.netRevenue), '', 'Doanh số bán trừ giá trị hàng trả', '/reports']
  ];
  const alerts = stats.topLowStock || [];
  return `<main class="workspace overview-workspace">
    <div class="page-title"><div><p class="page-eyebrow">KHÔNG GIAN QUẢN TRỊ</p><h1>Tổng quan cửa hàng</h1><p class="muted">Xin chào, ${escape(user.name)}. Theo dõi hàng hóa và hoạt động kinh doanh của bạn.</p></div><div class="page-actions"><a class="button-outline" href="/reports">Xem báo cáo ${icon('arrow')}</a><a class="button" href="/inventory/receive">${icon('in')} Nhập kho</a></div></div>
    <div class="overview-scope"><span class="scope-dot" aria-hidden="true"></span>Tổng hợp trên toàn bộ dữ liệu đã ghi nhận</div>
    <div class="overview-metrics">${metrics.map(([symbol, label, value, unit, note, url]) => `<a class="overview-metric" href="${url}"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon(symbol)}</span></div><div class="overview-metric-value">${value}${unit ? `<span>${unit}</span>` : ''}</div><div class="overview-metric-note"><span>${note}</span><span class="metric-detail">Chi tiết ${icon('arrow')}</span></div></a>`).join('')}</div>
    <div class="overview-middle">
      <section class="overview-panel"><div class="section-heading"><div><h2>Doanh thu theo danh mục</h2></div><span class="overview-period">Toàn bộ dữ liệu</span></div><div class="overview-revenue-breakdown"><div><span>Doanh số bán</span><strong>${money(stats.grossRevenue)}</strong></div><div><span>Giá trị hàng trả</span><strong>${money(stats.returnsValue)}</strong></div></div>${revenueChart(stats.categoryRevenue || [])}</section>
      <section class="overview-panel attention-panel"><div class="section-heading"><div><h2>Cần theo dõi</h2></div>${icon('check')}</div><a class="attention-item" href="/requests"><span class="attention-icon">${icon('check')}</span><div><strong>Yêu cầu chờ duyệt</strong><span>${pending ? 'Trả hàng và xử lý hàng hỏng' : 'Không có yêu cầu đang chờ'}</span></div><span class="attention-count">${count(pending)}</span></a><a class="attention-item" href="/inventory/low-stock"><span class="attention-icon attention-amber">${icon('alert')}</span><div><strong>Sản phẩm tồn thấp</strong><span>${stats.lowStockCount ? 'Cần kiểm tra và bổ sung hàng' : 'Chưa có sản phẩm cần bổ sung'}</span></div><span class="attention-count">${count(stats.lowStockCount)}</span></a><a class="attention-item" href="/products"><span class="attention-icon">${icon('box')}</span><div><strong>Tồn đang kinh doanh</strong><span>${count(stats.totalProducts)} sản phẩm</span></div><span class="attention-count">${count(stats.totalStock)}</span></a><div class="valuation-note"><span>Giá trị vốn tồn kho</span><strong>${money(stats.totalValuation)}</strong><span>Theo giá cơ sở của hàng đang kinh doanh</span></div><a class="attention-bottom" href="/pricing">${icon('tag')} Quản lý quy tắc định giá ${icon('arrow')}</a></section>
    </div>
    <section class="overview-panel overview-stock"><div class="section-heading"><div><h2>Sản phẩm cần bổ sung hàng <span class="result-count">${count(stats.lowStockCount)}</span></h2><p>Tối đa 5 sản phẩm có tồn kho thấp nhất.</p></div><a class="text-link" href="/inventory/low-stock">Xem tất cả ${icon('arrow')}</a></div>${alerts.length ? `<div class="table-scroll"><table class="records-table"><caption class="category-sr-only">Sản phẩm cần bổ sung hàng</caption><thead><tr><th scope="col">Sản phẩm</th><th scope="col" class="num">Tồn hiện tại</th><th scope="col" class="num">Ngưỡng cảnh báo</th><th scope="col" class="num">Giá bán</th><th scope="col">Thao tác</th></tr></thead><tbody>${alerts.map(product => `<tr><th scope="row"><span class="category-name">${escape(product.name)}</span><span class="category-id">ID: ${product.id}</span></th><td class="num" data-label="Tồn hiện tại"><span class="stock-count stock-empty">${count(product.stock)}</span></td><td class="num" data-label="Ngưỡng cảnh báo">${count(product.threshold)}</td><td class="num" data-label="Giá bán">${money(product.currentPrice)}</td><td data-label="Thao tác"><a class="row-action" href="/inventory/receive">${icon('in')}Nhập thêm hàng</a></td></tr>`).join('')}</tbody></table></div>` : `<div class="stock-clear">${icon('check')}<div><strong>Chưa có sản phẩm tồn thấp</strong><p>Cảnh báo sẽ xuất hiện khi số lượng tồn chạm ngưỡng đã cấu hình.</p></div><a class="text-link" href="/products">Xem sản phẩm ${icon('arrow')}</a></div>`}</section>
  </main>`;
}

module.exports = { homePage };
