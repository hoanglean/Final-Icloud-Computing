const { escape } = require('../utils/html');
const { datePeriods } = require('../utils/history');

function dateFilter(period) {
  return `<div><label for="history-period">Khoảng thời gian</label><select id="history-period" name="period">${Object.entries(datePeriods).map(([value, label]) => `<option value="${value}"${value === period ? ' selected' : ''}>${label}</option>`).join('')}</select></div>`;
}

function historyPagination({ page, pageSize, pageCount, total, offset, rows }, path, filters) {
  const numbers = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter(number => number >= 1 && number <= pageCount).sort((a, b) => a - b);
  function link(number, text, label) {
    const params = new URLSearchParams({ ...filters, page_size: pageSize, page: number });
    return `<a class="history-page-link" href="${path}?${escape(params.toString())}" aria-label="${label}">${text}</a>`;
  }
  const pages = numbers.map((number, index) => {
    const gap = index > 0 && number > numbers[index - 1] + 1 ? '<span aria-hidden="true">…</span>' : '';
    return gap + (number === page ? `<span class="history-page-link history-page-current" aria-current="page" aria-label="Trang ${page}">${page}</span>`
      : link(number, number, `Trang ${number}`));
  }).join('');
  const summary = rows.length ? `Hiển thị ${offset + 1}–${offset + rows.length} / ${total} mục` : '0 mục';
  return `<div class="history-pagination"><p class="small">${summary}</p>${pageCount > 1 ? `<nav class="history-page-links" aria-label="Phân trang lịch sử">
    ${page > 1 ? link(page - 1, '« Trang trước', 'Trang trước') : ''}
    ${pages}
    ${page < pageCount ? link(page + 1, 'Trang sau »', 'Trang sau') : ''}
  </nav>` : ''}</div>`;
}

module.exports = { dateFilter, historyPagination };
