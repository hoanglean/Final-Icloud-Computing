const { redirect, send, readForm } = require('../utils/http');
const { hasRole } = require('../middleware/auth');
const { categoriesPage } = require('../views/categories');

const notices = {
  created: 'Đã thêm danh mục.',
  renamed: 'Đã cập nhật tên danh mục.',
  activated: 'Đã mở lại danh mục.',
  deactivated: 'Đã ngừng sử dụng danh mục.'
};

async function categoryRoutes(req, res, { url, user, session, categoryRepository }) {
  const respond = (title, content, status = 200) => send(res, title, content, user, session, status, '/categories');
  if (!user) return redirect(res, '/login');
  if (!hasRole(user, 'admin')) return respond('Không có quyền', '<main class="workspace"><h1>Bạn không có quyền quản lý danh mục.</h1><a class="text-link" href="/staff">Về trang nhân viên</a></main>', 403);

  const base = url.pathname === '/categories';
  const action = /^\/categories\/([^/]+)\/(edit|status)$/.exec(url.pathname);
  if (!base && !action) return respond('Không tìm thấy', '<main class="workspace"><h1>Không tìm thấy thao tác danh mục.</h1><a class="text-link" href="/categories">Về danh sách danh mục</a></main>', 404);

  const render = async (options = {}, status = 200) => respond('Danh mục', categoriesPage(await categoryRepository.all(), session, options), status);
  if (base && req.method === 'GET') {
    const saved = url.searchParams.get('saved');
    return render({ notice: Object.hasOwn(notices, saved) ? notices[saved] : '' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', base ? 'GET, POST' : 'POST');
    return respond('Phương thức không hợp lệ', '<main class="workspace"><h1>Phương thức không được hỗ trợ.</h1><a class="text-link" href="/categories">Về danh sách danh mục</a></main>', 405);
  }
  if (!(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) return render({ error: 'Biểu mẫu không được hỗ trợ. Hãy tải lại trang và thử lại.' }, 415);
  const form = await readForm(req);
  if (form.csrf !== session.csrf) return render({ error: 'Phiên biểu mẫu không hợp lệ. Hãy tải lại trang và thử lại.' }, 403);

  const id = action ? Number(action[1]) : null;
  if (action && (!/^[1-9]\d*$/.test(action[1]) || !Number.isSafeInteger(id) || id > 2147483647)) return render({ error: 'Mã danh mục không hợp lệ.' }, 400);
  if (action?.[2] === 'status') {
    if (!['true', 'false'].includes(form.active)) return render({ error: 'Trạng thái danh mục không hợp lệ.' }, 400);
    const changed = await categoryRepository.setActive(id, form.active === 'true');
    if (!changed) return render({ error: 'Danh mục không còn tồn tại. Hãy kiểm tra lại danh sách.' }, 404);
    return redirect(res, `/categories?saved=${form.active === 'true' ? 'activated' : 'deactivated'}`);
  }

  const name = (form.name || '').trim();
  const values = base ? { name } : { editingId: id, editName: name };
  if (!name || [...name].length > 120 || /[\u0000-\u001f\u007f]/.test(name)) return render({ ...values, error: 'Tên danh mục cần từ 1 đến 120 ký tự và không chứa ký tự điều khiển.' }, 400);
  try {
    const changed = base ? await categoryRepository.create(name) : await categoryRepository.rename(id, name);
    if (!changed) return render({ ...values, error: 'Danh mục không còn tồn tại. Hãy kiểm tra lại danh sách.' }, 404);
    return redirect(res, `/categories?saved=${base ? 'created' : 'renamed'}`);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'categories_name_unique') return render({ ...values, error: 'Tên danh mục này đã tồn tại. Hãy chọn tên khác.' }, 409);
    throw error;
  }
}

module.exports = { categoryRoutes };
