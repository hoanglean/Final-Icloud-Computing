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

module.exports = { recalculatePrice };
