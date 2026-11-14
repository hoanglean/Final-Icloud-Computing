const pageSizes = [20, 50, 100];
const datePeriods = {
  all: 'Tất cả thời gian',
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  '7_days': '7 ngày qua',
  this_month: 'Tháng này'
};
const vietnamDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Saigon' });

function historyOptions(url, defaultSize = 20) {
  const rawPage = url.searchParams.get('page') || '';
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const requestedSize = Number(url.searchParams.get('page_size'));
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: pageSizes.includes(requestedSize) ? requestedSize : defaultSize
  };
}

function historyDateRange(url, now = new Date()) {
  const selection = url.searchParams.get('period');
  const period = Object.hasOwn(datePeriods, selection) ? selection : 'all';
  if (period === 'all') return { period, fromDate: null, toDate: null };

  const today = vietnamDate.format(now);
  const dateFromToday = days => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  const start = period === 'this_month' ? today.slice(0, 7) + '-01'
    : dateFromToday(period === 'yesterday' ? -1 : period === '7_days' ? -6 : 0);
  const end = dateFromToday(period === 'yesterday' ? 0 : 1);

  return { period, fromDate: start + 'T00:00:00+07:00', toDate: end + 'T00:00:00+07:00' };
}

async function loadHistory({ page, pageSize }, totalPromise, fetchRows) {
  const total = await totalPromise;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  page = Math.min(page, pageCount);
  const offset = (page - 1) * pageSize;
  const rows = total ? await fetchRows({ limit: pageSize, offset }) : [];
  return { rows, page, pageSize, pageCount, total, offset };
}

module.exports = { datePeriods, historyOptions, historyDateRange, loadHistory };
