function createReportsRepository(pool) {
  return {
    async dashboardSummary() {
      const { rows } = await pool.query(`WITH product_stats AS (
        SELECT
          count(*)::integer AS total_products,
          COALESCE(sum(stock), 0)::bigint AS total_stock,
          COALESCE(sum(stock * base_price), 0)::numeric AS total_valuation,
          COALESCE(sum(stock * current_price), 0)::numeric AS market_valuation
        FROM public.products
        WHERE is_active = true
      ),
      low_stock_stats AS (
        SELECT count(*)::integer AS low_stock_count
        FROM public.products p
        LEFT JOIN public.pricing_rules r ON r.product_id = p.id
        WHERE p.is_active = true AND p.stock <= COALESCE(r.low_stock, 10)
      ),
      today_sales AS (
        SELECT
          COALESCE(sum(CASE WHEN type = 'SALE' THEN quantity * unit_price ELSE 0 END), 0)::numeric AS gross_sales,
          COALESCE(sum(CASE WHEN type = 'RETURN' THEN quantity * unit_price ELSE 0 END), 0)::numeric AS returns
        FROM public.stock_movements
        WHERE (created_at AT TIME ZONE 'Asia/Saigon')::date = (now() AT TIME ZONE 'Asia/Saigon')::date
          AND type IN ('SALE', 'RETURN')
      ),
      recent_price_changes AS (
        SELECT count(*)::integer AS price_change_count
        FROM public.price_history
        WHERE (created_at AT TIME ZONE 'Asia/Saigon')::date = (now() AT TIME ZONE 'Asia/Saigon')::date
      )
      SELECT
        p.total_products AS "totalProducts",
        p.total_stock AS "totalStock",
        p.total_valuation AS "totalValuation",
        p.market_valuation AS "marketValuation",
        l.low_stock_count AS "lowStockCount",
        (s.gross_sales - s.returns)::numeric AS "todayNetRevenue",
        s.gross_sales AS "todayGrossSales",
        s.returns AS "todayReturns",
        r.price_change_count AS "todayPriceChanges"
      FROM product_stats p
      CROSS JOIN low_stock_stats l
      CROSS JOIN today_sales s
      CROSS JOIN recent_price_changes r`);

      const summary = rows[0] || {
        totalProducts: 0,
        totalStock: 0,
        totalValuation: 0,
        marketValuation: 0,
        lowStockCount: 0,
        todayNetRevenue: 0,
        todayGrossSales: 0,
        todayReturns: 0,
        todayPriceChanges: 0
      };

      const alerts = await pool.query(`SELECT p.id, p.name, p.stock, p.current_price AS "currentPrice",
        COALESCE(r.low_stock, 10) AS "threshold"
        FROM public.products p
        LEFT JOIN public.pricing_rules r ON r.product_id = p.id
        WHERE p.is_active = true AND p.stock <= COALESCE(r.low_stock, 10)
        ORDER BY p.stock ASC, lower(p.name) ASC
        LIMIT 5`);

      return {
        ...summary,
        topLowStock: alerts.rows
      };
    },

    async revenueSummary({ fromDate = null, toDate = null } = {}) {
      const { rows } = await pool.query(`WITH filtered AS (
        SELECT type, quantity, unit_price, (quantity * unit_price)::numeric AS amount
        FROM public.stock_movements
        WHERE type IN ('SALE', 'RETURN')
          AND ($1::timestamptz IS NULL OR created_at >= $1::timestamptz)
          AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
      )
      SELECT
        COALESCE(sum(CASE WHEN type = 'SALE' THEN amount ELSE 0 END), 0)::numeric AS "grossSales",
        COALESCE(sum(CASE WHEN type = 'RETURN' THEN amount ELSE 0 END), 0)::numeric AS "returns",
        (COALESCE(sum(CASE WHEN type = 'SALE' THEN amount ELSE 0 END), 0) -
         COALESCE(sum(CASE WHEN type = 'RETURN' THEN amount ELSE 0 END), 0))::numeric AS "netRevenue",
        COALESCE(sum(CASE WHEN type = 'SALE' THEN quantity ELSE 0 END), 0)::bigint AS "itemsSold",
        COALESCE(sum(CASE WHEN type = 'RETURN' THEN quantity ELSE 0 END), 0)::bigint AS "itemsReturned",
        count(CASE WHEN type = 'SALE' THEN 1 END)::integer AS "salesCount",
        count(CASE WHEN type = 'RETURN' THEN 1 END)::integer AS "returnsCount"
      FROM filtered`, [fromDate, toDate]);

      return rows[0] || {
        grossSales: 0,
        returns: 0,
        netRevenue: 0,
        itemsSold: 0,
        itemsReturned: 0,
        salesCount: 0,
        returnsCount: 0
      };
    },

    async revenueByCategory({ fromDate = null, toDate = null } = {}) {
      const { rows } = await pool.query(`SELECT
        c.id AS "categoryId",
        c.name AS "categoryName",
        COALESCE(sum(CASE WHEN s.type = 'SALE' THEN s.quantity * s.unit_price ELSE 0 END), 0)::numeric AS "grossSales",
        COALESCE(sum(CASE WHEN s.type = 'RETURN' THEN s.quantity * s.unit_price ELSE 0 END), 0)::numeric AS "returns",
        (COALESCE(sum(CASE WHEN s.type = 'SALE' THEN s.quantity * s.unit_price ELSE 0 END), 0) -
         COALESCE(sum(CASE WHEN s.type = 'RETURN' THEN s.quantity * s.unit_price ELSE 0 END), 0))::numeric AS "netRevenue",
        COALESCE(sum(CASE WHEN s.type = 'SALE' THEN s.quantity ELSE 0 END), 0)::bigint AS "itemsSold",
        COALESCE(sum(CASE WHEN s.type = 'RETURN' THEN s.quantity ELSE 0 END), 0)::bigint AS "itemsReturned"
      FROM public.categories c
      JOIN public.products p ON p.category_id = c.id
      JOIN public.stock_movements s ON s.product_id = p.id
      WHERE s.type IN ('SALE', 'RETURN')
        AND ($1::timestamptz IS NULL OR s.created_at >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR s.created_at < $2::timestamptz)
      GROUP BY c.id, c.name
      ORDER BY "netRevenue" DESC, lower(c.name) ASC`, [fromDate, toDate]);
      return rows;
    },

    async priceFluctuations({ fromDate = null, toDate = null, limit = 10 } = {}) {
      const boundedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
      const { rows } = await pool.query(`SELECT
        p.id AS "productId",
        p.name AS "productName",
        c.name AS "categoryName",
        p.current_price AS "currentPrice",
        count(h.id)::integer AS "changeCount",
        min(LEAST(h.old_price, h.new_price))::numeric AS "lowestPrice",
        max(GREATEST(h.old_price, h.new_price))::numeric AS "highestPrice"
      FROM public.price_history h
      JOIN public.products p ON p.id = h.product_id
      JOIN public.categories c ON c.id = p.category_id
      WHERE ($1::timestamptz IS NULL OR h.created_at >= $1::timestamptz)
        AND ($2::timestamptz IS NULL OR h.created_at < $2::timestamptz)
      GROUP BY p.id, p.name, c.name, p.current_price
      ORDER BY "changeCount" DESC, lower(p.name) ASC
      LIMIT $3`, [fromDate, toDate, boundedLimit]);
      return rows;
    }
  };
}

module.exports = { createReportsRepository };
