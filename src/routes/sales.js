const { applyStockChange } = require("../services/inventory");

const parseForm = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(new URLSearchParams(body)));
  });

async function salesRoutes(req, res, context) {
  const { url, user, session, pool } = context;

  // NHÂN VIÊN: BÁN HÀNG
  if (url.pathname === "/sales" && req.method === "POST") {
    if (!user || user.role !== "staff") {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Lỗi 403: Chỉ nhân viên mới được bán hàng.");
    }

    const body = await parseForm(req);

    // Kiểm tra bảo mật CSRF thủ công
    if (body.get("csrf") && body.get("csrf") !== session.csrfToken) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Lỗi xác thực CSRF.");
    }

    const productId = parseInt(body.get("product_id"));
    const quantity = parseInt(body.get("quantity"));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await applyStockChange(client, productId, "SALE", quantity, user.id);
      await client.query("COMMIT");
      res.writeHead(302, { Location: "/sales/history" });
      return res.end();
    } catch (err) {
      await client.query("ROLLBACK");
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(`Lỗi giao dịch bán hàng: ${err.message}`);
    } finally {
      client.release();
    }
  }

  // NHÂN VIÊN: XEM LỊCH SỬ CÁ NHÂN
  if (url.pathname === "/sales/history" && req.method === "GET") {
    if (!user || user.role !== "staff") return false;

    const result = await pool.query(
      `SELECT s.*, p.name as product_name, p.sku FROM public.stock_movements s 
       JOIN public.products p ON s.product_id = p.id 
       WHERE s.user_id = $1 AND s.type = 'SALE' ORDER BY s.created_at DESC`,
      [user.id]
    );
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(result.rows));
  }

  // ADMIN: XEM TOÀN BỘ LỊCH SỬ BÁN
  if (url.pathname === "/admin/sales-history" && req.method === "GET") {
    if (!user || user.role !== "admin") return false;

    const result = await pool.query(`
      SELECT s.*, p.name as product_name, u.name as staff_name FROM public.stock_movements s 
      JOIN public.products p ON s.product_id = p.id
      JOIN public.users u ON s.user_id = u.id 
      WHERE s.type = 'SALE' ORDER BY s.created_at DESC
    `);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(result.rows));
  }

  return false;
}

module.exports = { salesRoutes };
