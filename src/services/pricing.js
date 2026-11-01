const { requireAdmin } = require('./users');
const { transaction } = require('../utils/transaction');
const { invalid, recordId, activeValue } = require('../utils/validation');

// The caller holds the product row lock and supplies its transaction client.
// Cap whole-dong prices at the largest integer supported by NUMERIC(14,2).
async function recalculatePrice(client, productId, changedBy, reason) {
  const { rows } = await client.query(`WITH calculated AS (
    SELECT p.id, p.current_price AS old_price,
      LEAST(999999999999, round(CASE WHEN r.id IS NULL OR NOT r.enabled THEN p.base_price
        ELSE LEAST(r.max_price, GREATEST(r.min_price, CASE
          WHEN p.stock <= r.low_stock THEN p.base_price * (1 + r.increase_percent / 100)
          WHEN p.stock >= r.high_stock THEN p.base_price * (1 - r.discount_percent / 100)
          ELSE p.base_price END)) END)) AS new_price
    FROM public.products p LEFT JOIN public.pricing_rules r ON r.product_id = p.id WHERE p.id = $1
  ), updated AS (
    UPDATE public.products p SET current_price = c.new_price FROM calculated c
    WHERE p.id = c.id AND c.old_price <> c.new_price RETURNING p.id, c.old_price, p.current_price AS new_price
  ) INSERT INTO public.price_history(product_id, old_price, new_price, changed_by, reason)
    SELECT id, old_price, new_price, $2, $3 FROM updated RETURNING new_price AS "newPrice"`, [productId, changedBy, reason]);
  return rows[0];
}

function parsePricingRuleValues(form) {
  const lowStock = String(form.lowStock ?? form.low_stock ?? '').trim();
  if (!/^\d+$/.test(lowStock) || !Number.isSafeInteger(Number(lowStock)) || Number(lowStock) > 2147483646) {
    invalid('Ngưỡng tồn thấp phải là số nguyên không âm hợp lệ.');
  }
  const highStock = String(form.highStock ?? form.high_stock ?? '').trim();
  if (!/^\d+$/.test(highStock) || !Number.isSafeInteger(Number(highStock)) || Number(highStock) > 2147483647) {
    invalid('Ngưỡng tồn cao phải là số nguyên dương hợp lệ.');
  }
  const lowStockNum = Number(lowStock);
  const highStockNum = Number(highStock);
  if (highStockNum <= lowStockNum) {
    invalid('Ngưỡng tồn cao phải lớn hơn ngưỡng tồn thấp.');
  }

  const increasePercent = String(form.increasePercent ?? form.increase_percent ?? '').trim();
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(increasePercent) || Number(increasePercent) < 0 || Number(increasePercent) > 99999.99) {
    invalid('Phần trăm tăng giá phải từ 0 đến 99999.99 và tối đa 2 chữ số thập phân.');
  }

  const discountPercent = String(form.discountPercent ?? form.discount_percent ?? '').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(discountPercent) || Number(discountPercent) < 0 || Number(discountPercent) > 100) {
    invalid('Phần trăm giảm giá phải từ 0 đến 100 và tối đa 2 chữ số thập phân.');
  }

  const minPrice = String(form.minPrice ?? form.min_price ?? '').trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(minPrice)) {
    invalid('Giá tối thiểu phải không âm, tối đa 12 chữ số và 2 chữ số thập phân.');
  }

  const maxPrice = String(form.maxPrice ?? form.max_price ?? '').trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(maxPrice)) {
    invalid('Giá tối đa phải không âm, tối đa 12 chữ số và 2 chữ số thập phân.');
  }

  if (Number(maxPrice) < Number(minPrice)) {
    invalid('Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.');
  }

  const enabled = form.enabled === undefined ? true : activeValue(String(form.enabled));

  return {
    lowStock: lowStockNum,
    highStock: highStockNum,
    increasePercent: Number(increasePercent),
    discountPercent: Number(discountPercent),
    minPrice,
    maxPrice,
    enabled
  };
}

async function savePricingRule(pool, actor, productId, form) {
  productId = recordId(productId, 'Mã sản phẩm');
  const values = parsePricingRuleValues(form);
  return transaction(pool, async client => {
    await requireAdmin(client, actor);
    const product = (await client.query('SELECT id FROM public.products WHERE id = $1 FOR UPDATE', [productId])).rows[0];
    if (!product) invalid('Sản phẩm không còn tồn tại.', 404);

    await client.query(`INSERT INTO public.pricing_rules(product_id, low_stock, high_stock, increase_percent, discount_percent, min_price, max_price, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (product_id) DO UPDATE SET
        low_stock = EXCLUDED.low_stock,
        high_stock = EXCLUDED.high_stock,
        increase_percent = EXCLUDED.increase_percent,
        discount_percent = EXCLUDED.discount_percent,
        min_price = EXCLUDED.min_price,
        max_price = EXCLUDED.max_price,
        enabled = EXCLUDED.enabled`,
      [productId, values.lowStock, values.highStock, values.increasePercent, values.discountPercent, values.minPrice, values.maxPrice, values.enabled]);

    const updated = await recalculatePrice(client, productId, actor.id, 'Cập nhật quy tắc định giá');
    return { productId, updated: Boolean(updated), newPrice: updated?.newPrice };
  });
}

async function togglePricingRule(pool, actor, productId, enabled) {
  productId = recordId(productId, 'Mã sản phẩm');
  const active = activeValue(String(enabled));
  return transaction(pool, async client => {
    await requireAdmin(client, actor);
    const product = (await client.query('SELECT id FROM public.products WHERE id = $1 FOR UPDATE', [productId])).rows[0];
    if (!product) invalid('Sản phẩm không còn tồn tại.', 404);

    const result = await client.query('UPDATE public.pricing_rules SET enabled = $2 WHERE product_id = $1 RETURNING id', [productId, active]);
    if (!result.rowCount) invalid('Sản phẩm chưa có quy tắc định giá.', 404);

    const updated = await recalculatePrice(client, productId, actor.id, active ? 'Bật quy tắc định giá' : 'Tắt quy tắc định giá');
    return { productId, enabled: active, updated: Boolean(updated), newPrice: updated?.newPrice };
  });
}

async function recalculateProductPriceManually(pool, actor, productId) {
  productId = recordId(productId, 'Mã sản phẩm');
  return transaction(pool, async client => {
    await requireAdmin(client, actor);
    const product = (await client.query('SELECT id FROM public.products WHERE id = $1 FOR UPDATE', [productId])).rows[0];
    if (!product) invalid('Sản phẩm không còn tồn tại.', 404);

    const updated = await recalculatePrice(client, productId, actor.id, 'Tính lại giá thủ công');
    return { productId, updated: Boolean(updated), newPrice: updated?.newPrice };
  });
}

module.exports = {
  recalculatePrice,
  parsePricingRuleValues,
  savePricingRule,
  togglePricingRule,
  recalculateProductPriceManually
};
