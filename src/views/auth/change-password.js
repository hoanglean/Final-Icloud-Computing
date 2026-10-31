const { escape } = require('../../utils/html');

function passwordPage(session, error = '') {
  return `<main class="workspace narrow">
    <a class="text-link" href="/">Về trang chủ</a>
    <div class="password-heading"><h1>Đổi mật khẩu</h1><p class="muted">Sau khi đổi thành công, hãy đăng nhập lại bằng mật khẩu mới.</p></div>
    <section class="card password-card">
      ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}
      <form method="post" action="/change-password">
        <input type="hidden" name="csrf" value="${session.csrf}">
        <label for="current">Mật khẩu hiện tại</label><input id="current" name="currentPassword" type="password" autocomplete="current-password" required maxlength="128">
        <label for="next">Mật khẩu mới</label><input id="next" name="newPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128" aria-describedby="hint"><p id="hint" class="small">Từ 8 đến 128 ký tự, có chữ hoa, chữ thường và số.</p>
        <label for="confirm">Nhập lại mật khẩu mới</label><input id="confirm" name="confirmPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128">
        <button class="primary" type="submit">Lưu mật khẩu mới</button>
      </form>
    </section>
  </main>`;
}

module.exports = { passwordPage };