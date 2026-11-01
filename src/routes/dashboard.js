const { redirect, send, json } = require('../utils/http');
const { hasRole } = require('../middleware/auth');
const { homePage } = require('../views/dashboard/home');
const { reportsPage } = require('../views/reports');
const { invalid } = require('../utils/validation');

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

  if (!isAdminHome && !isReports) return false;

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
    const stats = await reportsRepository.dashboardSummary();
    if (req.headers.accept?.includes('application/json')) return json(res, stats);
    return send(res, 'Trang quản trị', homePage(user, stats), user, session, 200, '/admin');
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
