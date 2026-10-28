const { escape } = require('../../utils/html');

function categoriesPage(categories, session, { error = '', notice = '', name = '', editingId = null, editName = '' } = {}) {
  const csrf = `<input type="hidden" name="csrf" value="${escape(session.csrf)}">`;
  const rows = categories.map(category => `<tr>
    <th scope="row"><span class="category-name">${escape(category.name)}</span><span class="category-id">Mã danh mục: ${category.id}</span></th>
    <td data-label="Trạng thái"><span class="category-status${category.isActive ? '' : ' inactive'}">${category.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}</span></td>
    <td data-label="Thao tác"><div class="category-actions">
      <details class="category-edit"${editingId === category.id ? ' open' : ''}>
        <summary>Sửa tên</summary>
        <form method="post" action="/categories/${category.id}/edit">
          ${csrf}<label for="category-name-${category.id}">Tên danh mục</label>
          <input id="category-name-${category.id}" name="name" value="${escape(editingId === category.id ? editName : category.name)}" required maxlength="120">
          <button class="category-button" type="submit">Lưu tên</button>
        </form>
      </details>
      <form method="post" action="/categories/${category.id}/status">
        ${csrf}<input type="hidden" name="active" value="${category.isActive ? 'false' : 'true'}">
        <button class="category-text-button" type="submit" aria-label="${category.isActive ? 'Ngừng sử dụng' : 'Mở lại'} danh mục ${escape(category.name)}">${category.isActive ? 'Ngừng sử dụng' : 'Mở lại'}</button>
      </form>
    </div></td>
  </tr>`).join('');

  return `<main class="workspace categories-page">
    <div class="page-title"><div><h1>Danh mục</h1><p class="muted">Quản lý cách phân loại sản phẩm trong cửa hàng.</p></div><span class="role-badge">${categories.length} danh mục</span></div>
    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}
    ${notice ? `<div class="alert success" role="status">${escape(notice)}</div>` : ''}
    <div class="category-grid">
      <section class="card category-create" aria-labelledby="category-create-title">
        <h2 id="category-create-title">Thêm danh mục</h2><p class="muted">Đặt tên ngắn gọn để dễ tìm và phân loại sản phẩm.</p>
        <form method="post" action="/categories">
          ${csrf}<label for="category-name">Tên danh mục</label>
          <input id="category-name" name="name" value="${escape(name)}" placeholder="Ví dụ: Đồ uống" required maxlength="120" aria-describedby="category-name-hint">
          <p id="category-name-hint" class="small">Tối đa 120 ký tự. Tên danh mục không được trùng.</p>
          <button class="primary" type="submit">Thêm danh mục</button>
        </form>
      </section>
      <section class="category-list" aria-labelledby="category-list-title">
        <div class="category-list-heading"><h2 id="category-list-title">Danh sách danh mục</h2><p class="muted">${categories.filter(category => category.isActive).length} đang sử dụng</p></div>
        ${categories.length ? `<div class="category-table-wrap"><table class="category-table"><caption class="category-sr-only">Danh mục sản phẩm và thao tác quản lý</caption><thead><tr><th scope="col">Tên danh mục</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="category-empty"><h3>Chưa có danh mục</h3><p>Thêm danh mục đầu tiên để chuẩn bị phân loại sản phẩm.</p></div>'}
        <p class="small category-list-note">Ngừng sử dụng sẽ giữ lại danh mục và liên kết với các sản phẩm hiện có. Bạn có thể mở lại khi cần.</p>
      </section>
    </div>
  </main>`;
}

module.exports = { categoriesPage };
