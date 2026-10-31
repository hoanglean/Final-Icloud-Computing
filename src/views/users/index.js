const { escape } = require('../../utils/html');

function usersPage(users, current, session, { error = '', notice = '', values = {}, editingId = null } = {}) {
  const csrf = `<input type="hidden" name="csrf" value="${escape(session.csrf)}">`;
  const roles = selected => ['staff', 'admin'].map(role => `<option value="${role}"${selected === role ? ' selected' : ''}>${role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</option>`).join('');
  const rows = users.map(user => `<tr>
    <th scope="row">${escape(user.name)}${user.id === current.id ? '<span class="category-id">Tài khoản của bạn</span>' : ''}</th>
    <td data-label="Email" class="wrap-text">${escape(user.email)}</td>
    <td data-label="Vai trò">${user.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</td>
    <td data-label="Trạng thái"><span class="category-status${user.isActive ? '' : ' inactive'}">${user.isActive ? 'Hoạt động' : 'Đã khóa'}</span></td>
    <td data-label="Thao tác"><details class="record-edit"${editingId === user.id ? ' open' : ''}><summary>Đổi quyền, trạng thái</summary>
      <form method="post" action="/users/${user.id}/access">${csrf}
        <label for="role-${user.id}">Vai trò</label><select id="role-${user.id}" name="role">${roles(user.role)}</select>
        <label for="active-${user.id}">Trạng thái</label><select id="active-${user.id}" name="active"><option value="true"${user.isActive ? ' selected' : ''}>Hoạt động</option><option value="false"${!user.isActive ? ' selected' : ''}${user.id === current.id ? ' disabled' : ''}>Đã khóa</option></select>
        <button class="category-button" type="submit">Lưu thay đổi</button>
      </form></details></td>
  </tr>`).join('');
  return `<main class="workspace">
    <div class="page-title"><div><h1>Quản lý tài khoản</h1><p class="muted">Cấp tài khoản và quản lý quyền truy cập cửa hàng.</p></div><span class="role-badge">${users.length} tài khoản</span></div>
    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}${notice ? `<div class="alert success" role="status">${escape(notice)}</div>` : ''}
    <details class="create-disclosure"${error && !editingId ? ' open' : ''}><summary>Tạo tài khoản</summary>
      <form class="management-form card" method="post" action="/users">${csrf}
        <div><label for="user-name">Họ tên</label><input id="user-name" name="name" value="${escape(values.name || '')}" required maxlength="120" autocomplete="name"></div>
        <div><label for="user-email">Email</label><input id="user-email" name="email" type="email" value="${escape(values.email || '')}" required maxlength="254" autocomplete="email"></div>
        <div><label for="user-role">Vai trò</label><select id="user-role" name="role">${roles(values.role || 'staff')}</select></div>
        <div><label for="user-password">Mật khẩu ban đầu</label><input id="user-password" name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password" aria-describedby="user-password-hint"><p class="small" id="user-password-hint">Từ 8 đến 128 ký tự, có chữ hoa, chữ thường và số.</p></div>
        <div class="form-wide"><button class="button" type="submit">Tạo tài khoản</button></div>
      </form>
    </details>
    <p class="small management-note">Đổi vai trò hoặc trạng thái sẽ yêu cầu tài khoản đó đăng nhập lại. Luôn giữ ít nhất một quản trị viên hoạt động.</p>
    <table class="records-table"><caption class="category-sr-only">Danh sách tài khoản và quyền truy cập</caption><thead><tr><th scope="col">Họ tên</th><th scope="col">Email</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead><tbody>${rows}</tbody></table>
  </main>`;
}

module.exports = { usersPage };
