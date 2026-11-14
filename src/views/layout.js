const { escape } = require('../utils/html');
const { roleHome } = require('../config/roles');
const { sidebar } = require('./sidebar');

function layout(title, content, user, session, currentPath = '') {
  const role = user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';
  const account = user ? `<header class="app-header">
    <a class="brand" href="${roleHome(user.role)}" aria-label="V-Inventory, về trang chủ"><span class="logo">V</span><span>V-Inventory<span class="brand-caption">QUẢN LÝ CỬA HÀNG</span></span></a>
    <div class="header-location"><span>${user.role === 'admin' ? 'Quản trị' : 'Không gian làm việc'}</span><span aria-hidden="true">/</span><strong>${escape(title)}</strong></div>
    <div class="header-account">
      <div class="account-name"><span class="account-avatar" aria-hidden="true">${escape([...user.name][0] || 'V')}</span><div><strong>${escape(user.name)}</strong><span>${role}</span></div></div>
      <nav aria-label="Tài khoản"><a href="/change-password">Đổi mật khẩu</a><form method="post" action="/logout"><input type="hidden" name="csrf" value="${session.csrf}"><button class="nav-button" type="submit">Đăng xuất</button></form></nav>
    </div>
  </header>` : '';
  const modals = `<div id="confirm-modal" class="modal-backdrop" hidden><div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title"><div class="modal-header"><span class="modal-icon" aria-hidden="true">⚠️</span><h3 id="confirm-modal-title">Xác nhận thao tác</h3></div><div class="modal-body"><p id="confirm-modal-message">Bạn có chắc chắn muốn thực hiện thao tác này không?</p></div><div class="modal-actions"><button type="button" class="button" id="confirm-modal-cancel">Hủy bỏ</button><button type="button" class="button button-danger" id="confirm-modal-ok">Đồng ý thực hiện</button></div></div></div><div id="receipt-modal" class="modal-backdrop" hidden><div class="modal-box receipt-modal-box" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title"><div class="modal-header modal-no-print"><span class="modal-icon" aria-hidden="true">🧾</span><h3 id="receipt-modal-title">Hóa đơn bán lẻ</h3><button type="button" class="modal-close-btn" id="receipt-modal-close" aria-label="Đóng">&times;</button></div><div class="receipt-paper" id="receipt-paper-content"></div><div class="modal-actions modal-no-print"><button type="button" class="button" id="receipt-modal-cancel">Đóng</button><button type="button" class="button primary" id="receipt-modal-print">🖨️ In hóa đơn</button></div></div></div>`;
  const footer = `<footer class="app-footer"><div class="footer-brand"><span class="footer-mark" aria-hidden="true">V</span><div><strong>V-Inventory</strong><span class="footer-copyright">© ${new Date().getFullYear()} V-Inventory</span></div></div><div class="footer-description"><span>Quản lý tồn kho</span><span class="footer-divider" aria-hidden="true"></span><span>Định giá động</span></div></footer>`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="V-Inventory, không gian quản lý tồn kho và định giá dành cho cửa hàng."><title>${escape(title)} | V-Inventory</title><link rel="stylesheet" href="/style.css"><script src="/app.js" defer></script></head><body${user ? ' class="signed-in"' : ''}>${account}${user ? `<div class="app-shell">${sidebar(user, currentPath)}<div class="app-content">${content}${footer}</div></div>` : `${content}${footer}`}${modals}</body></html>`;
}

module.exports = { layout };
