const { redirect, send, json } = require('../utils/http');
const { hasRole } = require('../middleware/auth');
const { homePage } = require('../views/dashboard/home');
const { reportsPage } = require('../views/reports');
const { invalid } = require('../utils/validation');
const { escape } = require('../utils/html');

function generateReportsCsv({ summary, byCategory, fluctuations, filters }) {
  const periodMap = {
    all: 'Toàn bộ thời gian',
    today: 'Hôm nay',
    '7_days': '7 ngày gần nhất',
    '30_days': '30 ngày gần nhất',
    custom: `Tùy chọn (${filters.fromDate || '...'} đến ${filters.toDate || '...'})`
  };
  const periodLabel = periodMap[filters.period] || filters.period || 'Toàn bộ thời gian';
  const nowStr = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Saigon', dateStyle: 'short', timeStyle: 'short' }).format(new Date());

  const returnRate = Number(summary.grossSales) > 0
    ? ((Number(summary.returns) / Number(summary.grossSales)) * 100).toFixed(1)
    : '0.0';

  const lines = [
    `"BÁO CÁO KINH DOANH VÀ BIẾN ĐỘNG GIÁ - KHO VIỆT"`,
    `"Kỳ báo cáo","${periodLabel}"`,
    `"Từ ngày","${filters.fromDate || 'Tất cả'}"`,
    `"Đến ngày","${filters.toDate || 'Tất cả'}"`,
    `"Thời điểm xuất","${nowStr}"`,
    ``,
    `"1. CHỈ SỐ TÀI CHÍNH TỔNG QUAN"`,
    `"Chỉ số","Giá trị","Đơn vị tính","Ghi chú"`,
    `"Doanh thu thuần (Net Revenue)",${summary.netRevenue},"VND","Doanh thu bán trừ hàng trả lại"`,
    `"Doanh thu bán hàng gộp (Gross Sales)",${summary.grossSales},"VND","${summary.salesCount} giao dịch / ${summary.itemsSold} sản phẩm"`,
    `"Giá trị hàng hoàn trả (Returns)",${summary.returns},"VND","${summary.returnsCount} lượt trả / ${summary.itemsReturned} sản phẩm"`,
    `"Tỷ lệ hoàn trả (Return Rate)","${returnRate}%","%","Theo giá trị tiền hoàn trả"`,
    ``,
    `"2. DOANH THU THEO DANH MỤC SẢN PHẨM"`,
    `"Danh mục","Số lượng bán","Doanh số bán (VND)","Số lượng trả","Giá trị trả (VND)","Doanh thu thuần (VND)"`
  ];

  for (const c of byCategory) {
    lines.push(`"${(c.categoryName || '').replace(/"/g, '""')}",${c.itemsSold},${c.grossSales},${c.itemsReturned},${c.returns},${c.netRevenue}`);
  }

  lines.push(``);
  lines.push(`"3. TOP SẢN PHẨM BIẾN ĐỘNG GIÁ TRONG KỲ"`);
  lines.push(`"Mã SP","Tên sản phẩm","Danh mục","Số lần đổi giá","Giá thấp nhất (VND)","Giá cao nhất (VND)","Giá hiện tại (VND)"`);

  for (const f of fluctuations) {
    lines.push(`${f.productId},"${(f.productName || '').replace(/"/g, '""')}","${(f.categoryName || '').replace(/"/g, '""')}",${f.changeCount},${f.lowestPrice},${f.highestPrice},${f.currentPrice}`);
  }

  return '\uFEFF' + lines.join('\r\n');
}

function calculateDateRange(url) {
  let rawFrom = url.searchParams.get('from_date') || '';
  let rawTo = url.searchParams.get('to_date') || '';
  const period = url.searchParams.get('period') || (rawFrom || rawTo ? 'custom' : 'all');
  if (!['all', 'today', '7_days', '30_days', 'custom'].includes(period)) invalid('Khoảng thời gian không hợp lệ.');

  if (period === 'all') {
    rawFrom = rawTo = '';
  } else if (period !== 'custom') {
    const format = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Saigon' }).format(date);
    const now = new Date();
    const days = period === '7_days' ? 7 : period === '30_days' ? 30 : 1;
    rawFrom = format(new Date(now.getTime() - (days - 1) * 86400000));
    rawTo = format(now);
  } else {
    if (!rawFrom && !rawTo) invalid('Hãy chọn ít nhất một ngày cho khoảng thời gian tùy chọn.');
    for (const value of [rawFrom, rawTo].filter(Boolean)) {
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid('Ngày không hợp lệ. Vui lòng chọn ngày thực tế theo dạng năm-tháng-ngày.');
    }
    if (rawFrom && rawTo && rawFrom > rawTo) invalid('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.');
  }

  const fromDate = rawFrom ? new Date(`${rawFrom}T00:00:00+07:00`).toISOString() : null;
  // An exclusive next-day boundary includes PostgreSQL's sub-millisecond timestamps.
  const toDate = rawTo ? new Date(new Date(`${rawTo}T00:00:00+07:00`).getTime() + 86400000).toISOString() : null;
  return { period, rawFrom, rawTo, fromDate, toDate };
}

async function dashboardRoutes(req, res, { url, user, session, reportsRepository }) {
  const isAdminHome = url.pathname === '/admin';
  const isReports = url.pathname === '/reports';
  const isExport = url.pathname === '/reports/export';

  if (!isAdminHome && !isReports && !isExport) return false;

  if (!user) return redirect(res, '/login');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Phương thức không được hỗ trợ.');
  }

  // Handle /admin (Admin Dashboard)
  if (isAdminHome) {
    if (!hasRole(user, 'admin')) {
      return send(res, 'Không có quyền',
        '<main class="workspace"><h1>Bạn không có quyền vào trang quản trị.</h1><a class="button" href="/staff">Về trang nhân viên</a></main>',
        user, session, 403, '/admin');
    }
    const [summary, categoryRevenue] = await Promise.all([
      reportsRepository.dashboardSummary(),
      reportsRepository.revenueByCategory()
    ]);
    const stats = { ...summary, categoryRevenue };
    if (req.headers.accept?.includes('application/json')) return json(res, stats);
    return send(res, 'Trang quản trị', homePage(user, stats), user, session, 200, '/admin');
  }

  // Handle /reports/export (Export CSV Report)
  if (isExport) {
    if (!hasRole(user, 'admin')) {
      return send(res, 'Không có quyền',
        '<main class="workspace"><h1>Bạn không có quyền xuất báo cáo.</h1></main>',
        user, session, 403);
    }

    let range;
    try {
      range = calculateDateRange(url);
    } catch (error) {
      if (!error.status) throw error;
      return send(res, 'Lỗi tham số', `<main class="workspace"><div class="alert error">${escape(error.message)}</div><a class="text-link" href="/reports">Về báo cáo</a></main>`, user, session, error.status);
    }

    const { period, rawFrom, rawTo, fromDate, toDate } = range;
    const [summary, byCategory, fluctuations] = await Promise.all([
      reportsRepository.revenueSummary({ fromDate, toDate }),
      reportsRepository.revenueByCategory({ fromDate, toDate }),
      reportsRepository.priceFluctuations({ fromDate, toDate, limit: 100 })
    ]);

    const csv = generateReportsCsv({ summary, byCategory, fluctuations, filters: { period, fromDate: rawFrom, toDate: rawTo } });
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Saigon' }).format(new Date());
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bao-cao-kinh-doanh-${period}-${todayStr}.csv"`
    });
    return res.end(csv);
  }

  // Handle /reports (Business Reports)
  if (isReports) {
    if (!hasRole(user, 'admin')) {
      return send(res, 'Không có quyền',
        '<main class="workspace"><h1>Bạn không có quyền xem báo cáo kinh doanh.</h1><a class="text-link" href="/">Về trang chủ &rarr;</a></main>',
        user, session, 403, '/reports');
    }

    let range;
    try {
      range = calculateDateRange(url);
    } catch (error) {
      if (!error.status) throw error;
      if (req.headers.accept?.includes('application/json')) return json(res, { error: error.message }, error.status);
      return send(res, 'Báo cáo, thống kê', reportsPage({ error: error.message, filters: {
        period: url.searchParams.get('period') || 'custom',
        fromDate: url.searchParams.get('from_date') || '', toDate: url.searchParams.get('to_date') || ''
      } }), user, session, error.status, '/reports');
    }
    const { period, rawFrom, rawTo, fromDate, toDate } = range;

    const [summary, byCategory, fluctuations] = await Promise.all([
      reportsRepository.revenueSummary({ fromDate, toDate }),
      reportsRepository.revenueByCategory({ fromDate, toDate }),
      reportsRepository.priceFluctuations({ fromDate, toDate, limit: 10 })
    ]);

    if (req.headers.accept?.includes('application/json')) {
      return json(res, { summary, byCategory, fluctuations, filters: { period, fromDate: rawFrom, toDate: rawTo } });
    }

    return send(res, 'Báo cáo, thống kê',
      reportsPage({ summary, byCategory, fluctuations, filters: { period, fromDate: rawFrom, toDate: rawTo } }),
      user, session, 200, '/reports');
  }

  return false;
}

module.exports = { dashboardRoutes };
