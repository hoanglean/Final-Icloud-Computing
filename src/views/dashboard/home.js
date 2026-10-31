const { escape } = require('../../utils/html');
function homePage(user) {
  const admin = user.role === 'admin';
  return `<main class="workspace"><div class="page-title"><div><h1>Xin chào, ${escape(user.name)}.</h1><p class="muted">${admin ? 'Không gian dành cho người quản lý cửa hàng.' : 'Chúc bạn có một ngày làm việc thuận lợi.'}</p></div><span class="role-badge">${admin ? 'Quản trị viên' : 'Nhân viên'}</span></div></main>`;
}

module.exports = { homePage };
