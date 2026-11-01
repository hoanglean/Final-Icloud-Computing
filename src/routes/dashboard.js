const { redirect, send, json } = require('../utils/http');
const { hasRole } = require('../middleware/auth');
const { homePage } = require('../views/dashboard/home');
const { reportsPage } = require('../views/reports');

function calculateDateRange(url) {
  const period = url.searchParams.get('period') || (url.searchParams.get('from_date') ? 'custom' : 'all');
  let rawFrom = url.searchParams.get('from_date') || '';
  let rawTo = url.searchParams.get('to_date') || '';
  let fromDate = null;
  let toDate = null;

  const now = new Date();

  if (period === 'today') {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Saigon' }).format(now);
    rawFrom = todayStr;
    rawTo = todayStr;
    fromDate = new Date(`${todayStr}T00:00:00+07:00`).toISOString();
    toDate = new Date(`${todayStr}T23:59:59.999+07:00`).toISOString();
  } else if (period === '7_days') {
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    rawFrom = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Saigon' }).format(past);
    rawTo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Saigon' }).format(now);
    fromDate = new Date(`${rawFrom}T00:00:00+07:00`).toISOString();
    toDate = new Date(`${rawTo}T23:59:59.999+07:00`).toISOString();
  } else if (period === '30_days') {
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    rawFrom = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Saigon' }).format(past);
    rawTo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Saigon' }).format(now);
    fromDate = new Date(`${rawFrom}T00:00:00+07:00`).toISOString();
    toDate = new Date(`${rawTo}T23:59:59.999+07:00`).toISOString();
  } else if (rawFrom || rawTo) {
    if (rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom)) {
      fromDate = new Date(`${rawFrom}T00:00:00+07:00`).toISOString();
    }
    if (rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawTo)) {
      toDate = new Date(`${rawTo}T23:59:59.999+07:00`).toISOString();
    }
  }

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

    const { period, rawFrom, rawTo, fromDate, toDate } = calculateDateRange(url);

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
