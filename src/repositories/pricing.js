function createPricingRepository(pool) {
  return {
    async listRules() {
      const { rows } = await pool.query(`SELECT p.id AS "productId", p.name AS "productName", p.category_id AS "categoryId",
        c.name AS "categoryName", p.base_price AS "basePrice", p.current_price AS "currentPrice", p.stock, p.is_active AS "isActive",
        r.id AS "ruleId", r.low_stock AS "lowStock", r.high_stock AS "highStock",
        r.increase_percent AS "increasePercent", r.discount_percent AS "discountPercent",
        r.min_price AS "minPrice", r.max_price AS "maxPrice", r.enabled
        FROM public.products p
        JOIN public.categories c ON c.id = p.category_id
        LEFT JOIN public.pricing_rules r ON r.product_id = p.id
        ORDER BY p.is_active DESC, lower(p.name), p.id`);
      return rows;
    },
    async findRuleByProductId(productId) {
      const { rows } = await pool.query(`SELECT p.id AS "productId", p.name AS "productName", p.category_id AS "categoryId",
        c.name AS "categoryName", p.base_price AS "basePrice", p.current_price AS "currentPrice", p.stock, p.is_active AS "isActive",
        r.id AS "ruleId", r.low_stock AS "lowStock", r.high_stock AS "highStock",
        r.increase_percent AS "increasePercent", r.discount_percent AS "discountPercent",
        r.min_price AS "minPrice", r.max_price AS "maxPrice", r.enabled
        FROM public.products p
        JOIN public.categories c ON c.id = p.category_id
        LEFT JOIN public.pricing_rules r ON r.product_id = p.id
        WHERE p.id = $1`, [productId]);
      return rows[0];
    },
    async history({ productId = null, limit = 100 } = {}) {
      const boundedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
      const { rows } = await pool.query(`SELECT h.id, h.product_id AS "productId", p.name AS "productName",
        h.old_price AS "oldPrice", h.new_price AS "newPrice", h.reason,
        h.changed_by AS "changedBy", u.name AS "userName", h.created_at AS "createdAt"
        FROM public.price_history h
        JOIN public.products p ON p.id = h.product_id
        LEFT JOIN public.users u ON u.id = h.changed_by
        WHERE ($1::integer IS NULL OR h.product_id = $1)
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT $2`, [productId, boundedLimit]);
      return rows;
    }
  };
}

module.exports = { createPricingRepository };

