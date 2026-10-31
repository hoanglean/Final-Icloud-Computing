const { redirect, send, readForm } = require('../utils/http');
const { recordId, activeValue } = require('../utils/validation');
const { createUser, updateUserAccess } = require('../services/users');
const { usersPage } = require('../views/users');
const { destroySession } = require('../services/session');

async function userRoutes(req, res, { url, user, session, id: sessionId, userRepository, pool }) {
  const respond = (content, status = 200) => send(res, 'Quản lý tài khoản', content, user, session, status, '/users');
  if (!user) return redirect(res, '/login');
  if (user.role !== 'admin') return respond('<main class="workspace"><h1>Bạn không có quyền quản lý tài khoản.</h1></main>', 403);
  const action = /^\/users\/([^/]+)\/access$/.exec(url.pathname);
  const base = url.pathname === '/users';
  if (!base && !action) return respond('<main class="workspace"><h1>Không tìm thấy thao tác tài khoản.</h1></main>', 404);
  const render = async (options = {}, status = 200) => respond(usersPage(await userRepository.list(), user, session, options), status);
  if (base && req.method === 'GET') return render({ notice: url.searchParams.get('saved') === 'created' ? 'Đã tạo tài khoản.' : url.searchParams.get('saved') === 'access' ? 'Đã cập nhật quyền và trạng thái tài khoản.' : '' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', base ? 'GET, POST' : 'POST');
    return render({ error: 'Phương thức không được hỗ trợ.' }, 405);
  }
  if (!(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) return render({ error: 'Biểu mẫu không được hỗ trợ.' }, 415);
  const form = await readForm(req);
  if (form.csrf !== session.csrf) return render({ error: 'Phiên biểu mẫu không hợp lệ. Hãy tải lại trang.' }, 403);
  try {
    if (base) {
      await createUser(pool, user, form);
      return redirect(res, '/users?saved=created');
    }
    const changedSelf = await updateUserAccess(pool, user, recordId(action[1], 'Mã tài khoản'), form.role, activeValue(form.active));
    if (changedSelf) {
      destroySession(res, sessionId);
      return redirect(res, '/login');
    }
    return redirect(res, '/users?saved=access');
  } catch (error) {
    const options = base ? { values: { name: form.name, email: form.email, role: form.role } } : { editingId: Number(action[1]) };
    if (error.code === '23505' && error.constraint === 'users_email_key') return render({ ...options, error: 'Email này đã được sử dụng.' }, 409);
    if (error.status) return render({ ...options, error: error.message }, error.status);
    throw error;
  }
}

module.exports = { userRoutes };
