function createInventoryRepository(pool) {
  return {
    async lowStock() {
      const { rows } = await pool.query(`SELECT p.id, p.name, p.stock, p.current_price AS "currentPrice", (p.image_data IS NOT NULL) AS "hasImage"
        FROM public.products p LEFT JOIN public.pricing_rules r ON r.product_id = p.id
        WHERE p.is_active = true AND p.stock <= COALESCE(r.low_stock, 10)
        ORDER BY p.stock, lower(p.name), p.id`);
      return rows;
    },
    async history({ salesOnly = false, userId = null } = {}) {
      const { rows } = await pool.query(`SELECT s.id, s.product_id AS "productId", p.name AS "productName", s.type, s.quantity,
        s.unit_price AS "unitPrice", s.user_id AS "userId", u.name AS "userName", s.note, s.created_at AS "createdAt"
        FROM public.stock_movements s JOIN public.products p ON p.id = s.product_id JOIN public.users u ON u.id = s.user_id
        WHERE (NOT $1::boolean OR s.type = 'SALE') AND ($2::integer IS NULL OR s.user_id = $2)
        ORDER BY s.created_at DESC, s.id DESC LIMIT 100`, [salesOnly, userId]);
      return rows;
    }
  };
}

module.exports = { createInventoryRepository };
