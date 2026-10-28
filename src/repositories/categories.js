function createCategoryRepository(pool) {
  return {
    async all() {
      const { rows } = await pool.query('SELECT id, name, is_active AS "isActive" FROM public.categories ORDER BY is_active DESC, lower(name), id');
      return rows;
    },
    async create(name) {
      const { rows } = await pool.query('INSERT INTO public.categories(name) VALUES ($1) RETURNING id', [name]);
      return rows[0];
    },
    async rename(id, name) {
      const { rows } = await pool.query('UPDATE public.categories SET name = $1 WHERE id = $2 RETURNING id', [name, id]);
      return rows[0];
    },
    async setActive(id, active) {
      const { rows } = await pool.query('UPDATE public.categories SET is_active = $1 WHERE id = $2 RETURNING id', [active, id]);
      return rows[0];
    }
  };
}

module.exports = { createCategoryRepository };
