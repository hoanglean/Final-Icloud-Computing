const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(value);

function salePage(products, session, { quantities, error }) {
  const rows = products.map(product => {
    const quantity = quantities[`quantity_${product.id}`] || '';
    return `<li class="sale-product" data-product-id="${product.id}">
      <div class="product-identity">
        ${product.hasImage ? `<img class="product-thumbnail" src="/products/${product.id}/image" alt="" width="48" height="48" loading="lazy">` : '<span class="product-no-image">Chưa có ảnh</span>'}
        <div><strong class="sale-product-name">${escape(product.name)}</strong><span class="small sale-product-id">ID: ${product.id}</span></div>
      </div>
      <div><strong>${money(product.currentPrice)}</strong><div class="small">${product.stock ? `Còn ${product.stock}` : 'Hết hàng'}</div></div>
      <div><label class="category-sr-only" for="sale-quantity-${product.id}">Số lượng ${escape(product.name)} (ID ${product.id})</label>
        <input id="sale-quantity-${product.id}" name="quantity_${product.id}" type="number" inputmode="numeric" min="1" max="${product.stock}" step="1" data-price="${escape(product.currentPrice)}" value="${escape(quantity)}" placeholder="—"${product.stock ? '' : ' disabled'}></div>
    </li>`;
  }).join('');
  return `<main class="workspace">
    <div class="page-title"><div><h1>Bán hàng</h1><p class="muted">Nhập số lượng cho từng sản phẩm bạn muốn bán.</p></div><a class="text-link" href="/sales/history">Xem lịch sử</a></div>
    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}
    ${rows ? `<form id="sale-form" class="sale-form" method="post" action="/sales">
      <input type="hidden" name="csrf" value="${escape(session.csrf)}">
      <section class="sale-catalog card" aria-labelledby="sale-catalog-title">
        <h2 id="sale-catalog-title">Sản phẩm</h2>
        <div id="sale-search-field" hidden><label for="sale-search">Tìm sản phẩm</label><input id="sale-search" type="search" placeholder="Nhập tên hoặc ID sản phẩm"></div>
        <div class="sale-columns" aria-hidden="true"><span>Sản phẩm</span><span>Giá bán và tồn</span><span>Số lượng</span></div>
        <ul class="sale-products" role="list">${rows}</ul>
        <p class="muted" id="sale-search-empty" role="status" hidden>Không tìm thấy sản phẩm.</p>
      </section>
      <section class="sale-summary card" aria-labelledby="sale-summary-title">
        <h2 id="sale-summary-title">Lượt bán</h2>
        <div id="sale-totals" aria-live="polite" hidden><p id="sale-selection" class="muted">Chưa chọn sản phẩm</p><ul id="sale-selected-products" class="sale-selected-products" role="list"></ul><p class="sale-total"><span>Tạm tính</span><strong id="sale-total">${money(0)}</strong></p></div>
        <p class="small">Giá bán và tồn kho được kiểm tra lại khi lưu.</p>
        <button class="button" type="submit"${products.some(product => product.stock > 0) ? '' : ' disabled'}>Ghi nhận bán hàng</button>
      </section>
    </form>` : '<div class="card category-empty"><p>Chưa có sản phẩm đang kinh doanh.</p></div>'}
  </main>`;
}

module.exports = { salePage };
