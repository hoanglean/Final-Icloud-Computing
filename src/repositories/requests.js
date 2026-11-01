function createRequestRepository(pool) {
  return {
    async list({ userId = null } = {}) {
      const { rows } = await pool.query(`SELECT r.id, r.type, r.product_id AS "productId", p.name AS "productName",
        r.quantity, r.reason, r.related_movement_id AS "relatedMovementId", r.requested_by AS "requestedBy",
        requester.name AS "requesterName", r.status, r.reviewed_by AS "reviewedBy", reviewer.name AS "reviewerName",
        r.reviewed_at AS "reviewedAt", r.review_note AS "reviewNote", r.movement_id AS "movementId", r.created_at AS "createdAt"
        FROM public.stock_requests r
        JOIN public.products p ON p.id = r.product_id
        JOIN public.users requester ON requester.id = r.requested_by
        LEFT JOIN public.users reviewer ON reviewer.id = r.reviewed_by
        WHERE ($1::integer IS NULL OR r.requested_by = $1)
        ORDER BY CASE r.status WHEN 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC, r.id DESC`, [userId]);
      return rows;
    },

    async activeProducts() {
      const { rows } = await pool.query(`SELECT id, name, stock FROM public.products
        WHERE is_active = true ORDER BY lower(name), id`);
      return rows;
    },

    async returnableSales({ userId = null } = {}) {
      const { rows } = await pool.query(`SELECT s.id AS "saleId", s.product_id AS "productId", p.name AS "productName",
        s.created_at AS "createdAt",
        s.quantity - COALESCE(returned.quantity, 0) - COALESCE(pending.quantity, 0) AS remaining
        FROM public.stock_movements s
        JOIN public.products p ON p.id = s.product_id
        LEFT JOIN (
          SELECT related_movement_id, sum(quantity) AS quantity
          FROM public.stock_movements WHERE type = 'RETURN' GROUP BY related_movement_id
        ) returned ON returned.related_movement_id = s.id
        LEFT JOIN (
          SELECT related_movement_id, sum(quantity) AS quantity
          FROM public.stock_requests WHERE type = 'RETURN' AND status = 'PENDING' GROUP BY related_movement_id
        ) pending ON pending.related_movement_id = s.id
        WHERE s.type = 'SALE' AND ($1::integer IS NULL OR s.user_id = $1)
          AND s.quantity - COALESCE(returned.quantity, 0) - COALESCE(pending.quantity, 0) > 0
        ORDER BY s.created_at DESC, s.id DESC`, [userId]);
      return rows;
    },

    async createDamage(client, { productId, quantity, reason, requestedBy }) {
      const { rows } = await client.query(`INSERT INTO public.stock_requests(type, product_id, quantity, reason, requested_by)
        SELECT 'DAMAGE', id, $2, $3, $4 FROM public.products WHERE id = $1 AND is_active = true
        RETURNING id`, [productId, quantity, reason, requestedBy]);
      return rows[0];
    },

    async createReturn(client, { saleId, quantity, reason, requestedBy, role }) {
      // Match inventory's product-before-sale lock order when approvals run concurrently.
      await client.query(`SELECT id FROM public.products WHERE id = (
        SELECT product_id FROM public.stock_movements WHERE id = $1 AND type = 'SALE'
      ) FOR UPDATE`, [saleId]);
      const sale = (await client.query(`SELECT id, product_id AS "productId", quantity, user_id AS "userId"
        FROM public.stock_movements WHERE id = $1 AND type = 'SALE' FOR UPDATE`, [saleId])).rows[0];
      if (!sale) return null;
      if (role === 'staff' && sale.userId !== requestedBy) return { forbidden: true };

      const totals = (await client.query(`SELECT
        (SELECT COALESCE(sum(quantity), 0) FROM public.stock_movements WHERE type = 'RETURN' AND related_movement_id = $1) AS returned,
        (SELECT COALESCE(sum(quantity), 0) FROM public.stock_requests WHERE type = 'RETURN' AND status = 'PENDING' AND related_movement_id = $1) AS pending`, [saleId])).rows[0];
      if (Number(totals.returned) + Number(totals.pending) + quantity > sale.quantity) return { exceedsLimit: true };

      const { rows } = await client.query(`INSERT INTO public.stock_requests(type, product_id, quantity, reason, related_movement_id, requested_by)
        VALUES ('RETURN', $1, $2, $3, $4, $5) RETURNING id`, [sale.productId, quantity, reason, saleId, requestedBy]);
      return rows[0];
    },

    async findForUpdate(client, id) {
      const { rows } = await client.query(`SELECT id, type, product_id AS "productId", quantity, reason,
        related_movement_id AS "relatedMovementId", status
        FROM public.stock_requests WHERE id = $1 FOR UPDATE`, [id]);
      return rows[0];
    },

    async setReview(client, { id, status, reviewedBy, reviewNote, movementId }) {
      const { rows } = await client.query(`UPDATE public.stock_requests
        SET status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4, movement_id = $5
        WHERE id = $1 AND status = 'PENDING' RETURNING id`, [id, status, reviewedBy, reviewNote, movementId]);
      return rows[0];
    }
  };
}

module.exports = { createRequestRepository };
