function createProductRepository(pool) {
  return {
    async list({ q = '', category = null, status = 'all' } = {}, admin = false) {
      const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      const { rows } = await pool.query(`SELECT p.id, p.name, p.category_id AS "categoryId", c.name AS "categoryName", p.current_price AS "currentPrice", p.stock, p.is_active AS "isActive", (p.image_data IS NOT NULL) AS "hasImage"${admin ? ', p.base_price AS "basePrice"' : ''}
        FROM public.products p JOIN public.categories c ON c.id = p.category_id
        WHERE (p.name ILIKE $1 OR p.id::text = $4) AND ($2::integer IS NULL OR p.category_id = $2) AND ($3 = 'all' OR p.is_active = ($3 = 'active'))
        ORDER BY p.is_active DESC, lower(p.name), p.id`, [pattern, category, status, q]);
      return rows;
    },
    async find(id, lock = false) {
      const { rows } = await pool.query(`SELECT id, name, category_id AS "categoryId", base_price AS "basePrice", current_price AS "currentPrice", stock, is_active AS "isActive", (image_data IS NOT NULL) AS "hasImage" FROM public.products WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
      return rows[0];
    },
    async image(id) {
      const { rows } = await pool.query('SELECT image_data FROM public.products WHERE id = $1', [id]);
      return rows[0]?.image_data;
    },
    async create({ name, categoryId, basePrice, image }) {
      // Retain the legacy SKU column for existing data; its value is now assigned internally.
      const { rows } = await pool.query(`WITH product_id AS (
        SELECT nextval(pg_get_serial_sequence('public.products', 'id'))::integer AS id
      ) INSERT INTO public.products(id, sku, name, category_id, base_price, current_price, image_data)
        SELECT id, 'ID-' || id, $1, $2, $3, LEAST(999999999999, round($3::numeric)), $4 FROM product_id RETURNING id`, [name, categoryId, basePrice, image ?? null]);
      return rows[0];
    },
    async update(id, { name, categoryId, basePrice, image }) {
      await pool.query('UPDATE public.products SET name = $2, category_id = $3, base_price = $4, image_data = CASE WHEN $5::boolean THEN $6::bytea ELSE image_data END WHERE id = $1', [id, name, categoryId, basePrice, image !== undefined, image ?? null]);
    },
    async setActive(id, active) {
      await pool.query('UPDATE public.products SET is_active = $2 WHERE id = $1', [id, active]);
    }
  };
}

module.exports = { createProductRepository };
