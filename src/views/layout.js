const { escape } = require('../utils/html');
const { roleHome } = require('../config/roles');
const { sidebar } = require('./sidebar');
function layout(title, content, user, session, currentPath = '') {
  const role = user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Kho Việt</title><link rel="stylesheet" href="/style.css"></head><body${user ? ' class="signed-in"' : ''}>${user ? `<header class="app-header"><a class="brand" href="${roleHome(user.role)}"><span class="logo">K</span>Kho Việt</a><div class="header-account"><div class="account-name"><strong>${escape(user.name)}</strong><span>${role}</span></div><nav aria-label="Tài khoản"><a href="/change-password">Đổi mật khẩu</a><form method="post" action="/logout"><input type="hidden" name="csrf" value="${session.csrf}"><button class="nav-button">Đăng xuất ↗</button></form></nav></div></header><div class="app-shell">${sidebar(user, currentPath)}<div class="app-content">${content}</div></div>` : content}<footer>Kho Việt <span>Quản lý tồn kho & định giá động</span></footer></body></html>`;
}

module.exports = { layout };
