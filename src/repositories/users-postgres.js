function createPostgresUserRepository(pool) {
  return {
    async all() {
      const { rows } = await pool.query('SELECT id, name, email, role, password_hash AS "passwordHash", is_active AS "isActive", session_version AS version FROM public.users ORDER BY id');
      return rows;
    },
    async changePassword(id, oldHash, passwordHash) {
      const result = await pool.query('UPDATE public.users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 AND password_hash = $3 AND is_active = true RETURNING id', [passwordHash, id, oldHash]);
      return result.rowCount === 1;
    }
  };
}

module.exports = { createPostgresUserRepository };
