const { createProductRepository } = require('../repositories/products');
const { recalculatePrice } = require('./pricing');
const { requireAdmin } = require('./users');
const { transaction } = require('../utils/transaction');
const { invalid, text, recordId, price } = require('../utils/validation');
const { prepareProductImage } = require('./product-images');

function productValues(form) {
  return { name: text(form.name, 'Tên sản phẩm', 200), categoryId: recordId(form.categoryId, 'Danh mục'), basePrice: price(form.basePrice) };
}

async function checkCategory(client, categoryId, previousId) {
  const { rows } = await client.query('SELECT is_active AS "isActive" FROM public.categories WHERE id = $1 FOR SHARE', [categoryId]);
  if (!rows.length || (!rows[0].isActive && categoryId !== previousId)) invalid('Hãy chọn một danh mục đang sử dụng.', 409);
}

async function saveProduct(pool, actor, id, form, imageFile = null) {
  const values = productValues(form);
  if (form.removeImage !== undefined && form.removeImage !== 'true') invalid('Yêu cầu gỡ ảnh không hợp lệ.');
  if (imageFile && form.removeImage === 'true') invalid('Hãy chọn thay ảnh hoặc gỡ ảnh, không chọn cả hai.');
  values.image = imageFile ? await prepareProductImage(imageFile) : form.removeImage === 'true' ? null : undefined;
  return transaction(pool, async client => {
    await requireAdmin(client, actor);
    const repository = createProductRepository(client);
    const previous = id ? await repository.find(id, true) : null;
    if (id && !previous) invalid('Sản phẩm không còn tồn tại.', 404);
    await checkCategory(client, values.categoryId, previous?.categoryId);
    if (!id) return repository.create(values);
    await repository.update(id, values);
    if (Number(previous.basePrice) !== Number(values.basePrice)) await recalculatePrice(client, id, actor.id, 'Thay đổi giá cơ sở');
    return { id };
  });
}

async function setProductActive(pool, actor, id, active) {
  return transaction(pool, async client => {
    await requireAdmin(client, actor);
    const repository = createProductRepository(client);
    const product = await repository.find(id, true);
    if (!product) invalid('Sản phẩm không còn tồn tại.', 404);
    if (active) await checkCategory(client, product.categoryId);
    await repository.setActive(id, active);
  });
}

module.exports = { saveProduct, setProductActive };
