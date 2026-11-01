const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(value || 0);

function reportsPage({ summary = {}, byCategory = [], fluctuations = [], filters = {}, error = '' } = {}) {
  const returnRate = Number(summary.grossSales) > 0
    ? ((Number(summary.returns) / Number(summary.grossSales)) * 100).toFixed(1)
    : '0.0';

  const categoryRows = byCategory.map(c => `<tr>
    <th scope="row"><span class="category-name">${escape(c.categoryName)}</span></th>
    <td class="num" data-label="Đã bán">${c.itemsSold}</td>
    <td class="num" data-label="Doanh số bán">${money(c.grossSales)}</td>
    <td class="num" data-label="Đã trả">${c.itemsReturned}</td>
    <td class="num" data-label="Giá trị trả">${money(c.returns)}</td>
    <td class="num" data-label="Doanh thu thuần"><strong>${money(c.netRevenue)}</strong></td>
  </tr>`).join('');

  const fluctuationRows = fluctuations.map(f => `<tr>
    <th scope="row">
      <span class="category-name">${escape(f.productName)}</span>
      <span class="category-id">ID: ${f.productId} &middot; ${escape(f.categoryName)}</span>
    </th>
    <td class="num" data-label="Số lần đổi"><span class="role-badge">${f.changeCount} lần</span></td>
    <td class="num" data-label="Thấp nhất">${money(f.lowestPrice)}</td>
    <td class="num" data-label="Cao nhất">${money(f.highestPrice)}</td>
    <td class="num" data-label="Giá hiện tại"><strong>${money(f.currentPrice)}</strong></td>
  </tr>`).join('');

  return `<main class="workspace">
    <div class="page-title">
      <div>
        <h1>Báo cáo kinh doanh</h1>
        <p class="muted">Theo dõi doanh thu thực tế sau hoàn trả, phân tích theo danh mục và tần suất biến động giá.</p>
      </div>
      <a class="button" href="/pricing/history">Xem nhật ký giá</a>
    </div>

    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}
    <form class="filter-form card report-filter" method="get" action="/reports">
      <div>
        <label for="filter-period">Khoảng thời gian</label>
        <select id="filter-period" name="period" aria-describedby="period-help">
          <option value="all"${filters.period === 'all' || !filters.period ? ' selected' : ''}>Toàn bộ thời gian</option>
          <option value="today"${filters.period === 'today' ? ' selected' : ''}>Hôm nay</option>
          <option value="7_days"${filters.period === '7_days' ? ' selected' : ''}>7 ngày gần nhất</option>
          <option value="30_days"${filters.period === '30_days' ? ' selected' : ''}>30 ngày gần nhất</option>
          <option value="custom"${filters.period === 'custom' ? ' selected' : ''}>Tùy chọn khoảng ngày</option>
        </select>
        <p class="small muted" id="period-help">Chọn khoảng thời gian rồi bấm Xem báo cáo. Để nhập ngày, chọn Tùy chọn khoảng ngày.</p>
      </div>

      <div>
        <label for="from-date">Từ ngày</label>
        <input id="from-date" name="from_date" type="date" value="${escape(filters.fromDate || '')}">
      </div>

      <div>
        <label for="to-date">Đến ngày</label>
        <input id="to-date" name="to_date" type="date" value="${escape(filters.toDate || '')}">
      </div>

      <div class="report-filter-actions">
        <button class="button" type="submit">Xem báo cáo</button>
        <a class="text-link" href="/reports">Đặt lại</a>
      </div>
    </form>

    ${error ? '' : `
    <div class="metrics-grid">
      <div class="card">
        <p class="small muted metric-label">Doanh thu thuần (SALE &minus; RETURN)</p>
        <h2 class="metric-value metric-accent">${money(summary.netRevenue)}</h2>
        <p class="small muted metric-note">Không tính hàng hỏng và kiểm kê</p>
      </div>

      <div class="card">
        <p class="small muted metric-label">Doanh thu bán hàng gộp</p>
        <h2 class="metric-value">${money(summary.grossSales)}</h2>
        <p class="small muted metric-note">${summary.salesCount} giao dịch &middot; ${summary.itemsSold} sản phẩm</p>
      </div>

      <div class="card">
        <p class="small muted metric-label">Giá trị hàng trả lại</p>
        <h2 class="metric-value metric-error">${money(summary.returns)}</h2>
        <p class="small muted metric-note">${summary.returnsCount} lượt trả &middot; ${summary.itemsReturned} sản phẩm</p>
      </div>

      <div class="card">
        <p class="small muted metric-label">Tỷ lệ hoàn trả hàng</p>
        <h2 class="metric-value">${returnRate}%</h2>
        <p class="small muted metric-note">Theo giá trị tiền hoàn trả</p>
      </div>
    </div>

    <div class="page-title report-section-title">
      <div>
        <h2>Doanh thu theo danh mục sản phẩm</h2>
        <p class="small muted">Tổng hợp doanh thu thuần và số lượng bán theo từng nhóm hàng.</p>
      </div>
    </div>

    ${byCategory.length ? `
      <div class="table-scroll report-section">
        <table class="records-table">
          <caption class="category-sr-only">Doanh thu chi tiết theo từng danh mục</caption>
          <thead>
            <tr>
              <th scope="col">Danh mục</th>
              <th scope="col">Số lượng bán</th>
              <th scope="col">Doanh số bán</th>
              <th scope="col">Số lượng trả</th>
              <th scope="col">Giá trị trả</th>
              <th scope="col">Doanh thu thuần</th>
            </tr>
          </thead>
          <tbody>${categoryRows}</tbody>
        </table>
      </div>
    ` : `
      <div class="card report-empty report-section">
        <p class="muted">Không có giao dịch bán hàng nào trong khoảng thời gian đã chọn.</p>
      </div>
    `}

    <div class="page-title report-section-title">
      <div>
        <h2>Sản phẩm biến động giá nhiều nhất</h2>
        <p class="small muted">Thống kê tần suất thay đổi giá theo quy tắc định giá động trong kỳ.</p>
      </div>
    </div>

    ${fluctuationRows.length ? `
      <div class="table-scroll">
        <table class="records-table">
          <caption class="category-sr-only">Top sản phẩm có giá thay đổi nhiều nhất</caption>
          <thead>
            <tr>
              <th scope="col">Sản phẩm</th>
              <th scope="col">Tần suất</th>
              <th scope="col">Giá thấp nhất</th>
              <th scope="col">Giá cao nhất</th>
              <th scope="col">Giá hiện tại</th>
            </tr>
          </thead>
          <tbody>${fluctuationRows}</tbody>
        </table>
      </div>
    ` : `
      <div class="card report-empty">
        <p class="muted">Chưa ghi nhận biến động giá nào trong khoảng thời gian đã chọn.</p>
      </div>
    `}
    `}
  </main>`;
}

module.exports = { reportsPage };
