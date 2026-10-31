const { escape } = require('../../utils/html');

function loginPage(session, error = '', email = '') {
  return `<main class="login">
    <section class="intro">
      <a class="brand" href="/login" aria-label="Kho Việt, trang đăng nhập"><span class="logo">K</span><span>Kho Việt</span></a>
      <div class="intro-copy"><h1>Quản lý kho.<br>Chủ động giá.</h1><p>Không gian quản lý tồn kho và định giá của cửa hàng.</p></div>
      <p class="intro-bottom">Dành cho quản trị viên và nhân viên cửa hàng.</p>
    </section>
    <section class="login-panel" aria-labelledby="login-title"><div class="form-wrap">
      <h2 id="login-title">Đăng nhập</h2><p class="muted">Sử dụng tài khoản được cấp để tiếp tục.</p>
      ${error ? `<div id="login-error" class="alert error" role="alert">${escape(error)}</div>` : ''}
      <form method="post" action="/login">
        <input type="hidden" name="csrf" value="${session.csrf}">
        <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" placeholder="ban@khoviet.vn" required maxlength="254" value="${escape(email)}"${error ? ' aria-invalid="true" aria-describedby="login-error"' : ''}>
        <label for="password">Mật khẩu</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu của bạn" required maxlength="128"${error ? ' aria-invalid="true" aria-describedby="login-error"' : ''}>
        <button class="primary" type="submit">Đăng nhập</button>
      </form>
      <p class="small">Tài khoản được cấp bởi quản trị viên của nhóm.</p>
    </div></section>
  </main>`;
}

module.exports = { loginPage };