const { escape } = require('../utils/html');

function stockPicker({ label, name, selected, items, placeholder = 'Nhập tên hoặc ID sản phẩm' }) {
  return `<fieldset class="form-wide stock-picker">
        <legend>${escape(label)}</legend>
        <div id="stock-picker-search" hidden><label for="stock-query">Tìm sản phẩm</label><input id="stock-query" type="search" placeholder="${escape(placeholder)}"></div>
        <div class="stock-picker-list">${items.map(product => `<label class="stock-picker-row" data-stock-id="${product.id}">
          <input type="radio" name="${name}" value="${product.id}" required${String(selected) === String(product.id) ? ' checked' : ''}>
          ${product.hasImage ? `<img class="product-thumbnail" src="/products/${product.productId ?? product.id}/image" alt="" width="40" height="40" loading="lazy">` : '<span class="product-no-image">Chưa có ảnh</span>'}
          <span><strong class="stock-picker-name">${escape(product.name)}</strong><span class="small sale-product-id">${escape(product.detail)}</span></span>
          <span>${escape(product.limit)}</span>
        </label>`).join('')}</div>
        <p id="stock-picker-empty" class="muted" role="status" hidden>Không tìm thấy kết quả.</p>
      </fieldset>`;
}

module.exports = { stockPicker };
