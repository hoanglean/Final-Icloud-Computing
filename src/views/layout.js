const { escape } = require('../utils/html');
const { roleHome } = require('../config/roles');
const { sidebar } = require('./sidebar');

function layout(title, content, user, session, currentPath = '') {
  const role = user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';
  const account = user ? `<header class="app-header">
    <a class="brand" href="${roleHome(user.role)}" aria-label="Kho Việt, về trang chủ"><span class="logo">K</span><span>Kho Việt<span class="brand-caption">QUẢN LÝ CỬA HÀNG</span></span></a>
    <div class="header-location"><span>${user.role === 'admin' ? 'Quản trị' : 'Không gian làm việc'}</span><span aria-hidden="true">/</span><strong>${escape(title)}</strong></div>
    <div class="header-account">
      <div class="account-name"><span class="account-avatar" aria-hidden="true">${escape([...user.name][0] || 'K')}</span><div><strong>${escape(user.name)}</strong><span>${role}</span></div></div>
      <nav aria-label="Tài khoản"><a href="/change-password">Đổi mật khẩu</a><form method="post" action="/logout"><input type="hidden" name="csrf" value="${session.csrf}"><button class="nav-button" type="submit">Đăng xuất</button></form></nav>
    </div>
  </header>` : '';
  const footer = `<footer class="app-footer"><div class="footer-brand"><span class="footer-mark" aria-hidden="true">K</span><div><strong>Kho Việt</strong><span class="footer-copyright">© ${new Date().getFullYear()} Kho Việt</span></div></div><div class="footer-description"><span>Quản lý tồn kho</span><span class="footer-divider" aria-hidden="true"></span><span>Định giá động</span></div></footer>`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Kho Việt, không gian quản lý tồn kho và định giá dành cho cửa hàng."><title>${escape(title)} | Kho Việt</title><link rel="stylesheet" href="/style.css"></head><body${user ? ' class="signed-in"' : ''}>${account}${user ? `<div class="app-shell">${sidebar(user, currentPath)}<div class="app-content">${content}${footer}</div></div>` : `${content}${footer}`}</body></html>`;
}

module.exports = { layout };
