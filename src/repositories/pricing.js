const historyFilter = "WHERE ($1::integer IS NULL OR h.product_id = $1)";

function createPricingRepository(pool) {
  return {
    async listCategories() {
      const { rows } = await pool.query(`SELECT id, name FROM public.categories ORDER BY lower(name), id`);
      return rows;
    },
    async listRules({ q = '', categoryId = '', ruleStatus = 'all', stockStatus = 'all' } = {}) {
      const conditions = [];
      const values = [];

      if (q && String(q).trim()) {
        values.push(`%${String(q).trim()}%`);
        const p1 = `$${values.length}`;
        const numericId = parseInt(q, 10);
        if (!isNaN(numericId) && String(numericId) === String(q).trim()) {
          values.push(numericId);
          const p2 = `$${values.length}`;
          conditions.push(`(p.name ILIKE ${p1} OR p.id = ${p2})`);
        } else {
          conditions.push(`p.name ILIKE ${p1}`);
        }
      }

      if (categoryId && String(categoryId).trim()) {
        const catId = parseInt(categoryId, 10);
        if (!isNaN(catId) && catId > 0) {
          values.push(catId);
          conditions.push(`p.category_id = $${values.length}`);
        }
      }

      if (ruleStatus === 'enabled') {
        conditions.push(`(r.id IS NOT NULL AND r.enabled = true)`);
      } else if (ruleStatus === 'disabled') {
        conditions.push(`(r.id IS NOT NULL AND r.enabled = false)`);
      } else if (ruleStatus === 'unconfigured') {
        conditions.push(`r.id IS NULL`);
      }

      if (stockStatus === 'low') {
        conditions.push(`(r.id IS NOT NULL AND r.enabled = true AND p.stock <= r.low_stock)`);
      } else if (stockStatus === 'high') {
        conditions.push(`(r.id IS NOT NULL AND r.enabled = true AND p.stock >= r.high_stock)`);
      } else if (stockStatus === 'normal') {
        conditions.push(`(r.id IS NOT NULL AND r.enabled = true AND p.stock > r.low_stock AND p.stock < r.high_stock)`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const queryText = `SELECT p.id AS "productId", p.name AS "productName", p.category_id AS "categoryId",
        c.name AS "categoryName", p.base_price AS "basePrice", p.current_price AS "currentPrice", p.stock, p.is_active AS "isActive",
        r.id AS "ruleId", r.low_stock AS "lowStock", r.high_stock AS "highStock",
        r.increase_percent AS "increasePercent", r.discount_percent AS "discountPercent",
        r.min_price AS "minPrice", r.max_price AS "maxPrice", r.enabled
        FROM public.products p
        JOIN public.categories c ON c.id = p.category_id
        LEFT JOIN public.pricing_rules r ON r.product_id = p.id
        ${whereClause}
        ORDER BY p.is_active DESC, lower(p.name), p.id`;

      const { rows } = await pool.query(queryText, values);
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
    async countHistory({ productId = null } = {}) {
      const { rows } = await pool.query(`SELECT count(*) AS total FROM public.price_history h ${historyFilter}`, [productId]);
      return Number(rows[0].total);
    },
    async history({ productId = null, limit = 100, offset = 0 } = {}) {
      const boundedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
      const { rows } = await pool.query(`SELECT h.id, h.product_id AS "productId", p.name AS "productName",
        h.old_price AS "oldPrice", h.new_price AS "newPrice", h.reason,
        h.changed_by AS "changedBy", u.name AS "userName", h.created_at AS "createdAt"
        FROM public.price_history h
        JOIN public.products p ON p.id = h.product_id
        LEFT JOIN public.users u ON u.id = h.changed_by
        ${historyFilter}
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT $2 OFFSET $3`, [productId, boundedLimit, offset]);
      return rows;
    }
  };
}

module.exports = { createPricingRepository };

