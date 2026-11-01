const { readForm, redirect, send, json } = require('../utils/http');
const { invalid, recordId } = require('../utils/validation');
const { savePricingRule, togglePricingRule, recalculateProductPriceManually } = require('../services/pricing');
const { pricingRulesPage, pricingRuleForm, priceHistoryPage } = require('../views/pricing');

async function pricingRoutes(req, res, { url, user, session, pricingRepository, pool }) {
  const isPricingBase = url.pathname === '/pricing';
  const isHistory = url.pathname === '/pricing/history';
  const editMatch = /^\/pricing\/([^/]+)\/edit$/.exec(url.pathname);
  const toggleMatch = /^\/pricing\/([^/]+)\/toggle$/.exec(url.pathname);
  const recalcMatch = /^\/pricing\/([^/]+)\/recalculate$/.exec(url.pathname);
  const saveMatch = !isHistory && /^\/pricing\/([^/]+)$/.exec(url.pathname);

  if (!isPricingBase && !isHistory && !editMatch && !toggleMatch && !recalcMatch && !saveMatch) {
    return false;
  }

  if (!user) return redirect(res, '/login');

  const currentNav = isHistory ? '/pricing/history' : '/pricing';
  const respond = (content, status = 200) => send(res, 'Định giá động', content, user, session, status, currentNav);

  if (user.role !== 'admin') {
    return respond('<main class="workspace"><h1>Bạn không có quyền quản lý định giá.</h1><a class="text-link" href="/products">Về sản phẩm</a></main>', 403);
  }

  const isGet = req.method === 'GET';
  const isPost = req.method === 'POST';

  if (isPricingBase || isHistory || editMatch) {
    if (!isGet) {
      res.setHeader('Allow', 'GET');
      return respond('<main class="workspace"><h1>Phương thức không được hỗ trợ.</h1></main>', 405);
    }
  } else if (toggleMatch || recalcMatch || saveMatch) {
    if (!isPost) {
      res.setHeader('Allow', 'POST');
      return respond('<main class="workspace"><h1>Phương thức không được hỗ trợ.</h1></main>', 405);
    }
  }

  const notices = {
    rule_saved: 'Đã lưu quy tắc định giá và tính lại giá bán.',
    rule_toggled: 'Đã cập nhật trạng thái quy tắc định giá.',
    recalculated: 'Đã tính lại giá bán sản phẩm thành công.'
  };

  // GET /pricing
  if (isPricingBase) {
    const q = url.searchParams.get('q') || '';
    const categoryId = url.searchParams.get('category') || '';
    const ruleStatus = url.searchParams.get('rule_status') || 'all';
    const stockStatus = url.searchParams.get('stock_status') || 'all';
    const filters = { q, categoryId, ruleStatus, stockStatus };

    const [products, categories] = await Promise.all([
      pricingRepository.listRules(filters),
      pricingRepository.listCategories ? pricingRepository.listCategories() : []
    ]);
    if (req.headers.accept?.includes('application/json')) return json(res, products);
    const saved = url.searchParams.get('saved');
    return respond(pricingRulesPage(products, categories, session, {
      filters,
      notice: Object.hasOwn(notices, saved) ? notices[saved] : ''
    }));
  }

  // GET /pricing/history
  if (isHistory) {
    const rawProductId = url.searchParams.get('product_id');
    let productId = null;
    try {
      if (rawProductId) productId = recordId(rawProductId, 'Mã sản phẩm');
    } catch (error) {
      return respond('<main class="workspace"><h1>Mã sản phẩm không hợp lệ.</h1><a class="text-link" href="/pricing/history">Về lịch sử giá</a></main>', error.status);
    }
    const [rows, allProducts] = await Promise.all([
      pricingRepository.history({ productId, limit: 100 }),
      pricingRepository.listRules()
    ]);
    if (req.headers.accept?.includes('application/json')) return json(res, rows);
    return respond(priceHistoryPage(rows, allProducts, { selectedProduct: productId }));
  }

  // GET /pricing/:productId/edit
  if (editMatch) {
    let productId;
    try {
      productId = recordId(editMatch[1], 'Mã sản phẩm');
    } catch (error) {
      return respond('<main class="workspace"><h1>Mã sản phẩm không hợp lệ.</h1><a class="text-link" href="/pricing">Về danh sách quy tắc</a></main>', 404);
    }
    const product = await pricingRepository.findRuleByProductId(productId);
    if (!product) {
      return respond('<main class="workspace"><h1>Sản phẩm không còn tồn tại.</h1><a class="text-link" href="/pricing">Về danh sách quy tắc</a></main>', 404);
    }
    return respond(pricingRuleForm(product, session));
  }

  // Handle POST actions
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    return respond('<main class="workspace"><h1>Biểu mẫu không được hỗ trợ.</h1></main>', 415);
  }

  const form = await readForm(req);
  if (!form.csrf || form.csrf !== session.csrf) {
    return respond('<main class="workspace"><h1>Phiên biểu mẫu không hợp lệ. Hãy tải lại trang và thử lại.</h1><a class="text-link" href="/pricing">Về danh sách quy tắc</a></main>', 403);
  }

  // POST /pricing/:productId/toggle
  if (toggleMatch) {
    try {
      const productId = recordId(toggleMatch[1], 'Mã sản phẩm');
      await togglePricingRule(pool, user, productId, form.enabled);
      return redirect(res, '/pricing?saved=rule_toggled');
    } catch (error) {
      if (!error.status) throw error;
      const status = error.status;
      const products = await pricingRepository.listRules();
      return respond(pricingRulesPage(products, session, { error: error.message }), status);
    }
  }

  // POST /pricing/:productId/recalculate
  if (recalcMatch) {
    try {
      const productId = recordId(recalcMatch[1], 'Mã sản phẩm');
      await recalculateProductPriceManually(pool, user, productId);
      return redirect(res, '/pricing?saved=recalculated');
    } catch (error) {
      if (!error.status) throw error;
      const status = error.status;
      const products = await pricingRepository.listRules();
      return respond(pricingRulesPage(products, session, { error: error.message }), status);
    }
  }

  // POST /pricing/:productId (Save rule)
  if (saveMatch) {
    let productId;
    try {
      productId = recordId(saveMatch[1], 'Mã sản phẩm');
      await savePricingRule(pool, user, productId, form);
      return redirect(res, '/pricing?saved=rule_saved');
    } catch (error) {
      if (!error.status) throw error;
      const status = error.status;
      const product = productId ? await pricingRepository.findRuleByProductId(productId) : null;
      if (!product) {
        const products = await pricingRepository.listRules();
        return respond(pricingRulesPage(products, session, { error: error.message }), status);
      }
      return respond(pricingRuleForm(product, session, { error: error.message, values: form }), status);
    }
  }

  return false;
}

module.exports = { pricingRoutes };

