const { invalid, recordId, text } = require('../utils/validation');
const { recalculatePrice } = require('./pricing');

// The caller owns the transaction; stock, history and prices share this client.
async function applyStockChange(client, productId, type, quantity, userId, note = null, relatedMovementId = null) {
  productId = recordId(productId, 'Mã sản phẩm');
  quantity = recordId(quantity, 'Số lượng');
  userId = recordId(userId, 'Tài khoản');
  if (!['IN', 'SALE', 'RETURN', 'ADJUST_IN', 'ADJUST_OUT', 'DAMAGE'].includes(type)) invalid('Loại giao dịch kho không hợp lệ.');
  const reasonRequired = ['ADJUST_IN', 'ADJUST_OUT', 'DAMAGE'].includes(type);
  note = reasonRequired || note?.trim() ? text(note, 'Ghi chú', 1000) : null;
  if (type === 'RETURN') relatedMovementId = recordId(relatedMovementId, 'Giao dịch bán gốc');
  else if (relatedMovementId !== null) invalid('Chỉ trả hàng mới được liên kết giao dịch bán gốc.');

  const actor = (await client.query('SELECT role FROM public.users WHERE id = $1 AND is_active = true FOR SHARE', [userId])).rows[0];
  if (!actor || actor.role !== (type === 'SALE' ? 'staff' : 'admin')) invalid('Tài khoản không có quyền thực hiện giao dịch này.', 403);
  const product = (await client.query('SELECT stock, current_price AS "currentPrice" FROM public.products WHERE id = $1 AND is_active = true FOR UPDATE', [productId])).rows[0];
  if (!product) invalid('Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.', 404);
  const increasing = ['IN', 'RETURN', 'ADJUST_IN'].includes(type);
  const newStock = product.stock + (increasing ? quantity : -quantity);
  if (newStock < 0) invalid('Số lượng tồn kho không đủ để thực hiện.', 409);
  if (newStock > 2147483647) invalid('Số lượng tồn kho vượt giới hạn cho phép.');

  let unitPrice = product.currentPrice;
  if (type === 'RETURN') {
    const original = (await client.query('SELECT type, product_id, quantity, unit_price FROM public.stock_movements WHERE id = $1 FOR UPDATE', [relatedMovementId])).rows[0];
    if (!original || original.type !== 'SALE' || original.product_id !== productId) invalid('Giao dịch trả hàng phải khớp sản phẩm của lần bán gốc.');
    const returned = (await client.query("SELECT COALESCE(sum(quantity), 0) AS quantity FROM public.stock_movements WHERE related_movement_id = $1 AND type = 'RETURN'", [relatedMovementId])).rows[0];
    if (Number(returned.quantity) + quantity > original.quantity) invalid('Số lượng trả vượt số lượng đã bán.', 409);
    unitPrice = original.unit_price;
  }

  // Record the original sale/return price before pricing the next sale.
  const movement = (await client.query(`INSERT INTO public.stock_movements(product_id, type, quantity, unit_price, user_id, note, related_movement_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [productId, type, quantity, unitPrice, userId, note, relatedMovementId])).rows[0];
  await client.query('UPDATE public.products SET stock = $2 WHERE id = $1', [productId, newStock]);
  await recalculatePrice(client, productId, userId, `Thay đổi tồn kho: ${type}`);
  return { id: movement.id, stock: newStock, unitPrice };
}

module.exports = { applyStockChange };
