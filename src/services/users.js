const { createPostgresUserRepository } = require('../repositories/users-postgres');
const { hashPassword } = require('./password');
const { transaction } = require('../utils/transaction');
const { invalid, text } = require('../utils/validation');

async function createUser(pool, actor, form) {
  const name = text(form.name, 'Họ tên', 120);
  const email = text(form.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('Email không hợp lệ.');
  if (!['admin', 'staff'].includes(form.role)) invalid('Vai trò không hợp lệ.');
  const password = form.password || '';
  if (password.length < 8 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) invalid('Mật khẩu cần 8 đến 128 ký tự, có chữ hoa, chữ thường và số.');
  const passwordHash = await hashPassword(password);
  return transaction(pool, async client => {
    await requireAdmin(client, actor);
    return createPostgresUserRepository(client).create({ name, email, role: form.role, passwordHash });
  });
}

async function requireAdmin(client, actor) {
  const { rows } = await client.query('SELECT id FROM public.users WHERE id = $1 AND role = $2 AND is_active = true AND session_version = $3 FOR SHARE', [actor.id, 'admin', actor.version]);
  if (!rows.length) invalid('Quyền quản trị đã thay đổi. Hãy đăng nhập lại.', 403);
}

async function updateUserAccess(pool, actor, id, role, active) {
  if (!['admin', 'staff'].includes(role)) invalid('Vai trò không hợp lệ.');
  return transaction(pool, async client => {
    const repository = createPostgresUserRepository(client);
    const users = await repository.lockForManagement();
    const current = users.find(user => user.id === actor.id && user.isActive && user.role === 'admin' && user.version === actor.version);
    if (!current) invalid('Quyền quản trị đã thay đổi. Hãy đăng nhập lại.', 403);
    const target = users.find(user => user.id === id);
    if (!target) invalid('Tài khoản không còn tồn tại.', 404);
    if (actor.id === id && !active) invalid('Bạn không thể tự khóa tài khoản của mình.', 409);
    if (target.role === 'admin' && target.isActive && (role !== 'admin' || !active) && users.filter(user => user.role === 'admin' && user.isActive).length <= 1) invalid('Phải giữ ít nhất một quản trị viên đang hoạt động.', 409);
    await repository.updateAccess(id, role, active);
    return actor.id === id && role !== actor.role;
  });
}

module.exports = { createUser, updateUserAccess, requireAdmin };
