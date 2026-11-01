const { escape } = require('../../utils/html');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(value));

function pricingRuleForm(product, session, { error = '', values = {} } = {}) {
  const lowStock = values.lowStock ?? product.lowStock ?? 10;
  const highStock = values.highStock ?? product.highStock ?? 100;
  const increasePercent = values.increasePercent ?? product.increasePercent ?? 10;
  const discountPercent = values.discountPercent ?? product.discountPercent ?? 10;
  const minPrice = values.minPrice ?? product.minPrice ?? Math.round(Number(product.basePrice) * 0.7);
  const maxPrice = values.maxPrice ?? product.maxPrice ?? Math.round(Number(product.basePrice) * 1.5);
  const enabled = values.enabled !== undefined ? Boolean(values.enabled === true || values.enabled === 'true') : product.enabled !== undefined ? Boolean(product.enabled) : true;

  return `<main class="workspace">
    <a class="text-link" href="/pricing">&larr; Về danh sách quy tắc định giá</a>
    <div class="page-title">
      <div>
        <h1>Cấu hình quy tắc định giá</h1>
        <p class="muted">${escape(product.productName)} (ID: ${product.productId}) &middot; ${escape(product.categoryName)}</p>
      </div>
      <span class="role-badge">Tồn: ${product.stock} &middot; Giá bán: ${money(product.currentPrice)}</span>
    </div>

    ${error ? `<div class="alert error" role="alert">${escape(error)}</div>` : ''}

    <form class="management-form card product-form" method="post" action="/pricing/${product.productId}">
      <input type="hidden" name="csrf" value="${escape(session.csrf)}">

      <div>
        <label for="rule-base-price">Giá cơ sở</label>
        <input id="rule-base-price" value="${money(product.basePrice)}" readonly>
        <p class="small">Giá tính toán luôn xuất phát từ giá cơ sở này (không cộng dồn).</p>
      </div>

      <div>
        <label for="rule-current-price">Giá bán hiện tại</label>
        <input id="rule-current-price" value="${money(product.currentPrice)}" readonly>
        <p class="small">Giá đang được áp dụng cho khách hàng khi tạo đơn bán.</p>
      </div>

      <div>
        <label for="rule-low-stock">Ngưỡng tồn thấp (khan hiếm)</label>
        <input id="rule-low-stock" name="lowStock" type="number" min="0" max="2147483646" step="1" value="${escape(lowStock)}" required inputmode="numeric">
        <p class="small">Khi tồn &le; ngưỡng này, giá bán sẽ tự động tăng.</p>
      </div>

      <div>
        <label for="rule-increase-percent">Tỷ lệ tăng giá (%)</label>
        <input id="rule-increase-percent" name="increasePercent" type="number" min="0" max="99999.99" step="0.01" value="${escape(increasePercent)}" required inputmode="decimal">
        <p class="small">Phần trăm tăng thêm dựa trên giá cơ sở (ví dụ: 10 = +10%).</p>
      </div>

      <div>
        <label for="rule-high-stock">Ngưỡng tồn cao (dư thừa)</label>
        <input id="rule-high-stock" name="highStock" type="number" min="1" max="2147483647" step="1" value="${escape(highStock)}" required inputmode="numeric">
        <p class="small">Khi tồn &ge; ngưỡng này, giá bán sẽ tự động giảm (phải lớn hơn tồn thấp).</p>
      </div>

      <div>
        <label for="rule-discount-percent">Tỷ lệ giảm giá (%)</label>
        <input id="rule-discount-percent" name="discountPercent" type="number" min="0" max="100" step="0.01" value="${escape(discountPercent)}" required inputmode="decimal">
        <p class="small">Phần trăm chiết khấu dựa trên giá cơ sở (tối đa 100%).</p>
      </div>

      <div>
        <label for="rule-min-price">Giá sàn tối thiểu (đồng)</label>
        <input id="rule-min-price" name="minPrice" type="number" min="0" max="999999999999.99" step="0.01" value="${escape(minPrice)}" required inputmode="decimal">
        <p class="small">Giá sau khi tính toán không bao giờ thấp hơn mức này.</p>
      </div>

      <div>
        <label for="rule-max-price">Giá trần tối đa (đồng)</label>
        <input id="rule-max-price" name="maxPrice" type="number" min="0" max="999999999999.99" step="0.01" value="${escape(maxPrice)}" required inputmode="decimal">
        <p class="small">Giá sau khi tính toán không bao giờ cao hơn mức này.</p>
      </div>

      <div class="form-wide">
        <label for="rule-enabled">Trạng thái kích hoạt</label>
        <select id="rule-enabled" name="enabled">
          <option value="true"${enabled ? ' selected' : ''}>Kích hoạt quy tắc (tự động điều chỉnh theo tồn kho)</option>
          <option value="false"${!enabled ? ' selected' : ''}>Tạm ngưng quy tắc (giữ nguyên giá cơ sở)</option>
        </select>
      </div>

      <p class="small form-wide">Sau khi lưu, giá bán của sản phẩm sẽ được tính toán lại ngay lập tức và ghi lịch sử nếu có chênh lệch.</p>

      <div class="form-wide form-actions">
        <button class="button" type="submit">Lưu quy tắc định giá</button>
        <a class="text-link" href="/pricing">Hủy bỏ</a>
      </div>
    </form>
  </main>`;
}

module.exports = { pricingRuleForm };

