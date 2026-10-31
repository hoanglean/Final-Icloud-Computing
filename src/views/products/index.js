const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value));

function categoryOptions(categories, selected, edit = false) {
  return categories.filter(category => !edit || category.isActive || String(category.id) === String(selected)).map(category => `<option value="${category.id}"${String(selected) === String(category.id) ? ' selected' : ''}>${escape(category.name)}${category.isActive ? '' : ' (đã ngừng)'}</option>`).join('');
}

function productsPage(products, categories, user, session, { error = '', notice = '', filters = {} } = {}) {
  const admin = user.role === 'admin';
  const rows = products.map(product => `<tr>
    <th scope="row"><div class="product-identity">${product.hasImage ? `<img class="product-thumbnail" src="/products/${product.id}/image" alt="Ảnh ${escape(product.name)}" width="64" height="64" loading="lazy">` : '<span class="product-no-image">Chưa có ảnh</span>'}<div><span class="category-name">${escape(product.name)}</span><span class="category-id">ID: ${product.id}</span></div></div></th>
    <td data-label="Danh mục" class="wrap-text">${escape(product.categoryName)}</td>
    ${admin ? `<td class="num" data-label="Giá cơ sở">${money(product.basePrice)}</td>` : ''}
    <td class="num" data-label="Giá bán">${money(product.currentPrice)}</td>
    <td class="num" data-label="Tồn kho">${product.stock}</td>
    <td data-label="Trạng thái"><span class="category-status${product.isActive ? '' : ' inactive'}">${product.isActive ? 'Kinh doanh' : 'Đã ngừng'}</span></td>
    ${admin ? `<td data-label="Thao tác"><a class="text-link" href="/products/${product.id}/edit">Sửa sản phẩm</a><form method="post" action="/products/${product.id}/status"><input type="hidden" name="csrf" value="${escape(session.csrf)}"><input type="hidden" name="active" value="${product.isActive ? 'false' : 'true'}"><button class="category-text-button" type="submit" aria-label="${product.isActive ? 'Ngừng kinh doanh' : 'Mở lại'} sản phẩm ${escape(product.name)}">${product.isActive ? 'Ngừng kinh doanh' : 'Mở lại'}</button></form></td>` : ''}
  </tr>`).join('');
  return `<main class="workspace">
    <div class="page-title"><div><h1>Sản phẩm</h1><p class="muted">${admin ? 'Quản lý sản phẩm, danh mục và giá cơ sở.' : 'Tra cứu giá bán, số lượng tồn và trạng thái sản phẩm.'}</p></div>${admin ? '<a class="button" href="/products/new">Thêm sản phẩm</a>' : ''}</div>
    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}${notice ? `<div class="alert success" role="status">${escape(notice)}</div>` : ''}
    <form class="filter-form" method="get" action="/products">
      <div><label for="product-search">Tìm theo tên hoặc ID</label><input id="product-search" name="q" type="search" maxlength="200" value="${escape(filters.q || '')}" placeholder="Nhập tên hoặc ID"></div>
      <div><label for="product-category">Danh mục</label><select id="product-category" name="category"><option value="">Tất cả danh mục</option>${categoryOptions(categories, filters.category)}</select></div>
      <div><label for="product-status">Trạng thái</label><select id="product-status" name="status">${[['all', 'Tất cả trạng thái'], ['active', 'Đang kinh doanh'], ['inactive', 'Đã ngừng']].map(([value, label]) => `<option value="${value}"${(filters.status || 'all') === value ? ' selected' : ''}>${label}</option>`).join('')}</select></div>
      <button class="button" type="submit">Lọc sản phẩm</button><a class="text-link" href="/products">Bỏ lọc</a>
    </form>
    <p class="small management-note">${products.length} sản phẩm${filters.q || filters.category || filters.status && filters.status !== 'all' ? ' phù hợp bộ lọc' : ''}</p>
    ${products.length ? `<div class="table-scroll"><table class="records-table"><caption class="category-sr-only">Sản phẩm, giá bán và số lượng tồn kho</caption><thead><tr><th scope="col">Sản phẩm</th><th scope="col">Danh mục</th>${admin ? '<th scope="col">Giá cơ sở</th>' : ''}<th scope="col">Giá bán</th><th scope="col">Tồn kho</th><th scope="col">Trạng thái</th>${admin ? '<th scope="col">Thao tác</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="category-empty"><h2>Không có sản phẩm phù hợp</h2><p>Thử đổi bộ lọc hoặc kiểm tra lại danh sách sản phẩm.</p></div>'}
  </main>`;
}

function productForm(values, categories, session, { error = '' } = {}) {
  const editing = Boolean(values.id);
  const available = categories.some(category => category.isActive || String(category.id) === String(values.categoryId));
  return `<main class="workspace">
    <a class="text-link" href="/products">Về danh sách sản phẩm</a>
    <div class="page-title"><div><h1>${editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h1><p class="muted">${editing ? 'Cập nhật thông tin và giá cơ sở của sản phẩm.' : 'Sản phẩm mới có tồn ban đầu bằng 0.'}</p></div></div>
    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}
    ${!available ? '<div class="alert error" role="alert">Cần có danh mục đang sử dụng trước khi thêm sản phẩm. <a class="text-link" href="/categories">Quản lý danh mục</a></div>' : ''}
    <form class="management-form card product-form" method="post" enctype="multipart/form-data" action="${editing ? `/products/${values.id}/edit` : '/products'}">
      <input type="hidden" name="csrf" value="${escape(session.csrf)}">
      <div><label for="product-id">ID sản phẩm</label><input id="product-id" value="${editing ? values.id : 'Tự động tạo khi lưu'}" readonly><p class="small">ID do hệ thống cấp và không thể chỉnh sửa.</p></div>
      <div><label for="product-name">Tên sản phẩm</label><input id="product-name" name="name" value="${escape(values.name || '')}" required maxlength="200"></div>
      <div><label for="product-form-category">Danh mục</label><select id="product-form-category" name="categoryId" required><option value="">Chọn danh mục</option>${categoryOptions(categories, values.categoryId, true)}</select></div>
      <div><label for="product-base-price">Giá cơ sở (đồng)</label><input id="product-base-price" name="basePrice" type="number" min="0" max="999999999999.99" step="0.01" value="${escape(values.basePrice ?? '')}" required inputmode="decimal" aria-describedby="price-hint"><p class="small" id="price-hint">Giá bán được tính lại theo quy tắc đang áp dụng khi giá cơ sở đổi.</p></div>
      <div class="form-wide product-image-field">
        ${values.hasImage ? `<img class="product-current-image" src="/products/${values.id}/image" alt="Ảnh hiện tại của ${escape(values.name || 'sản phẩm')}" width="160" height="160">` : ''}
        <label for="product-image">Ảnh sản phẩm</label><input id="product-image" class="image-file-input" name="image" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="image-hint">
        <p class="small" id="image-hint">JPG, PNG hoặc WebP, tối đa 2 MB. ${values.hasImage ? 'Để trống để giữ ảnh hiện tại.' : 'Có thể bổ sung ảnh sau.'}</p>
        ${values.hasImage ? '<label class="image-remove" for="product-remove-image"><input id="product-remove-image" type="checkbox" name="removeImage" value="true">Gỡ ảnh hiện tại</label>' : ''}
      </div>
      <p class="small form-wide">Số lượng tồn được cập nhật qua nghiệp vụ kho và bán hàng.</p>
      <div class="form-wide form-actions"><button class="button" type="submit"${available ? '' : ' disabled'}>${editing ? 'Lưu sản phẩm' : 'Thêm sản phẩm'}</button><a class="text-link" href="/products">Hủy</a></div>
    </form>
  </main>`;
}

module.exports = { productsPage, productForm };
