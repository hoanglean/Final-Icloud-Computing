const { redirect, send } = require('../utils/http');
const { readProductForm } = require('../utils/product-form');
const { invalid, recordId, activeValue } = require('../utils/validation');
const { saveProduct, setProductActive } = require('../services/products');
const { productsPage, productForm } = require('../views/products');

async function productRoutes(req, res, { url, user, session, productRepository, categoryRepository, pool }) {
  if (!user) return redirect(res, '/login');
  const admin = user.role === 'admin';
  const respond = (content, status = 200) => send(res, 'Sản phẩm', content, user, session, status, '/products');
  const renderList = async (options = {}, status = 200, filters = {}) => respond(productsPage(await productRepository.list(filters, admin), await categoryRepository.all(), user, session, { ...options, filters }), status);
  const renderForm = async (values = {}, options = {}, status = 200) => respond(productForm(values, await categoryRepository.all(), session, options), status);
  const base = url.pathname === '/products';
  const create = url.pathname === '/products/new';
  const action = /^\/products\/([^/]+)\/(edit|status)$/.exec(url.pathname);
  const imageAction = /^\/products\/([^/]+)\/image$/.exec(url.pathname);
  if (imageAction) {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Phương thức không được hỗ trợ.');
    }
    try {
      const imageId = recordId(imageAction[1], 'Mã sản phẩm');
      const data = await productRepository.image(imageId);
      if (!data) { res.writeHead(404); return res.end('Sản phẩm chưa có ảnh.'); }
      const image = Buffer.from(data);
      res.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Length': image.length, 'Content-Disposition': `inline; filename="product-${imageId}.webp"` });
      return res.end(req.method === 'HEAD' ? undefined : image);
    } catch (error) {
      if (!error.status) throw error;
      res.writeHead(error.status);
      return res.end(error.message);
    }
  }
  if (!base && !create && !action) return respond('<main class="workspace"><h1>Không tìm thấy thao tác sản phẩm.</h1></main>', 404);
  if (!admin && (!base || req.method !== 'GET')) return respond('<main class="workspace"><h1>Bạn không có quyền quản lý sản phẩm.</h1><a class="text-link" href="/products">Về danh sách sản phẩm</a></main>', 403);
  if (!['GET', 'POST'].includes(req.method) || (create && req.method !== 'GET') || (action?.[2] === 'status' && req.method !== 'POST')) {
    res.setHeader('Allow', create ? 'GET' : action?.[2] === 'status' ? 'POST' : 'GET, POST');
    return renderList({ error: 'Phương thức không được hỗ trợ.' }, 405);
  }
  if (req.method === 'GET') {
    try {
      if (create) return renderForm();
      if (action) {
        const product = await productRepository.find(recordId(action[1], 'Mã sản phẩm'));
        if (!product) return renderList({ error: 'Sản phẩm không còn tồn tại.' }, 404);
        return renderForm(product);
      }
      const q = (url.searchParams.get('q') || '').trim();
      if ([...q].length > 200 || /[\u0000-\u001f\u007f]/.test(q)) invalid('Từ khóa tìm kiếm tối đa 200 ký tự và không chứa ký tự điều khiển.');
      const category = url.searchParams.get('category');
      const status = url.searchParams.get('status') || 'all';
      if (!['all', 'active', 'inactive'].includes(status)) invalid('Bộ lọc trạng thái không hợp lệ.');
      const notices = { created: 'Đã thêm sản phẩm. Tồn ban đầu bằng 0.', updated: 'Đã cập nhật sản phẩm.', status: 'Đã cập nhật trạng thái sản phẩm.' };
      const saved = url.searchParams.get('saved');
      return renderList({ notice: Object.hasOwn(notices, saved) ? notices[saved] : '' }, 200, { q, category: category ? recordId(category, 'Danh mục') : null, status });
    } catch (error) {
      if (error.status) return renderList({ error: error.message }, error.status);
      throw error;
    }
  }
  let form, imageFile;
  try { ({ form, imageFile } = await readProductForm(req)); }
  catch (error) {
    if (error.status) return renderList({ error: error.message }, error.status);
    throw error;
  }
  if (form.csrf !== session.csrf) return renderList({ error: 'Phiên biểu mẫu không hợp lệ. Hãy tải lại trang.' }, 403);
  let id;
  try {
    id = action ? recordId(action[1], 'Mã sản phẩm') : null;
    if (action?.[2] === 'status') {
      if (imageFile || form.removeImage !== undefined) invalid('Đổi ảnh qua biểu mẫu sửa sản phẩm.');
      await setProductActive(pool, user, id, activeValue(form.active));
      return redirect(res, '/products?saved=status');
    }
    await saveProduct(pool, user, id, form, imageFile);
    return redirect(res, `/products?saved=${id ? 'updated' : 'created'}`);
  } catch (error) {
    if (!error.status) throw error;
    const message = error.message;
    const status = error.status;
    if (action?.[2] === 'status' || error.status === 404 || (action && !id)) return renderList({ error: message }, status);
    const current = id ? await productRepository.find(id) : null;
    return renderForm({ id, name: form.name, categoryId: form.categoryId, basePrice: form.basePrice, hasImage: current?.hasImage }, { error: message + (imageFile ? ' Hãy chọn lại tệp ảnh trước khi lưu.' : '') }, status);
  }
}

module.exports = { productRoutes };
