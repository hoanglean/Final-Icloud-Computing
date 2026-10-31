function createPostgresUserRepository(pool) {
  return {
    async all() {
      const { rows } = await pool.query('SELECT id, name, email, role, password_hash AS "passwordHash", is_active AS "isActive", session_version AS version FROM public.users ORDER BY id');
      return rows;
    },
    async list() {
      const { rows } = await pool.query('SELECT id, name, email, role, is_active AS "isActive" FROM public.users ORDER BY id');
      return rows;
    },
    async create({ name, email, role, passwordHash }) {
      const { rows } = await pool.query('INSERT INTO public.users(name, email, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id', [name, email, role, passwordHash]);
      return rows[0];
    },
    async lockForManagement() {
      // Lock in a fixed order so two admins cannot concurrently remove the last active admins.
      const { rows } = await pool.query('SELECT id, role, is_active AS "isActive", session_version AS version FROM public.users ORDER BY id FOR UPDATE');
      return rows;
    },
    async updateAccess(id, role, active) {
      await pool.query('UPDATE public.users SET role = $2, is_active = $3, session_version = session_version + 1 WHERE id = $1 AND (role <> $2 OR is_active <> $3)', [id, role, active]);
    },
    async changePassword(id, oldHash, passwordHash) {
      const result = await pool.query('UPDATE public.users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 AND password_hash = $3 AND is_active = true RETURNING id', [passwordHash, id, oldHash]);
      return result.rowCount === 1;
    }
  };
}

module.exports = { createPostgresUserRepository };
