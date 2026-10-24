const { navigation } = require('../config/navigation');
const { roleHome } = require('../config/roles');
const { escape } = require('../utils/html');

const icons = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  box: 'm3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7 5l10 5',
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  in: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  adjust: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  history: 'M3 4v5h5M3 9a9 9 0 1 1 0 7M12 7v5l3 2',
  alert: 'm12 3 10 18H2L12 3Zm0 6v5m0 3v1',
  cart: 'M2 3h3l3 12h11l3-9H6M9 20h.01M18 20h.01',
  return: 'M8 4 3 9l5 5M3 9h12a6 6 0 0 1 0 12h-4',
  check: 'M9 4H5v17h14V4h-4M9 2h6v5H9V2Zm-1 12 3 3 5-6',
  tag: 'M3 3h9l9 9-9 9-9-9V3Zm5 5h.01',
  chart: 'M4 3v18h17M8 16v-5m5 5V7m5 9v-8',
  users: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 0a4 4 0 0 1 0 8m2 3a4 4 0 0 1 3 4v3'
};

function sidebar(user, currentPath) {
  const admin = user.role === 'admin';
  const link = (path, label, icon) => `<a class="sidebar-link${currentPath === path ? ' active' : ''}" href="${path}"${currentPath === path ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[icon]}"></path></svg><span>${escape(label)}</span></a>`;
  const groups = navigation.map(group => {
    const items = group.items.filter(item => (!item.adminOnly || admin) && (!item.staffOnly || user.role === 'staff'));
    return items.length ? `<section class="sidebar-group"><h2>${escape(group.title)}</h2>${items.map(item => link(item.path, admin && item.adminLabel ? item.adminLabel : item.label, item.icon)).join('')}</section>` : '';
  }).join('');
  return `<aside class="sidebar"><details class="sidebar-menu" open><summary>Chức năng <span aria-hidden="true">☰</span></summary><nav class="sidebar-nav" aria-label="Chức năng nghiệp vụ">${link(roleHome(user.role), admin ? 'Tổng quan' : 'Trang chủ', 'home')}${groups}</nav></details></aside>`;
}

module.exports = { sidebar };
