async function applyStockChange(
  client,
  productId,
  type,
  quantity,
  userId,
  note = null,
  relatedMovementId = null
) {
  // 1. Khóa sản phẩm để chống Race Condition khi nhiều người thao tác cùng lúc
  const resProduct = await client.query(
    "SELECT current_price, stock, base_price FROM public.products WHERE id = $1 AND is_active = true FOR UPDATE",
    [productId]
  );
  if (resProduct.rows.length === 0)
    throw new Error("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.");

  const product = resProduct.rows[0];
  let newStock = product.stock;

  // 2. Tính số lượng tồn mới
  if (["SALE", "ADJUST_OUT", "DAMAGE"].includes(type)) {
    newStock -= quantity;
  } else if (["IN", "RETURN", "ADJUST_IN"].includes(type)) {
    newStock += quantity;
  }
  if (newStock < 0) throw new Error("Số lượng tồn kho không đủ để thực hiện.");

  // 3. Tính đơn giá (Hoàn trả thì lấy giá của lúc bán, ngược lại dùng giá hiện tại)
  let unitPrice = product.current_price;
  if (type === "RETURN" && relatedMovementId) {
    const resRelated = await client.query(
      "SELECT unit_price FROM public.stock_movements WHERE id = $1",
      [relatedMovementId]
    );
    if (resRelated.rows.length > 0) unitPrice = resRelated.rows[0].unit_price;
  }

  // 4. Lưu lịch sử giao dịch vào stock_movements
  await client.query(
    `INSERT INTO public.stock_movements (product_id, type, quantity, unit_price, user_id, note, related_movement_id) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [productId, type, quantity, unitPrice, userId, note, relatedMovementId]
  );

  // 5. Cập nhật số lượng tồn mới vào bảng products
  await client.query("UPDATE public.products SET stock = $1 WHERE id = $2", [
    newStock,
    productId,
  ]);

  // 6. GỌI DỊCH VỤ ĐỊNH GIÁ ĐỘNG (Thành viên 3 sẽ nhúng hàm của họ vào đây)
  // const { applyPricingRules } = require('./pricing');
  // await applyPricingRules(client, productId, newStock, product.base_price, userId);
}

module.exports = { applyStockChange };
