const { applyStockChange } = require("../services/inventory");

const parseForm = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(new URLSearchParams(body)));
  });

async function inventoryRoutes(req, res, context) {
  const { url, user, session, pool } = context;

  // NHÂN VIÊN & ADMIN: XEM CẢNH BÁO TỒN THẤP
  if (url.pathname === "/inventory/low-stock" && req.method === "GET") {
    if (!user) return false;

    const lowStockResult = await pool.query(`
      SELECT p.id, p.name, p.sku, p.stock, p.current_price FROM public.products p 
      LEFT JOIN public.pricing_rules pr ON p.id = pr.product_id 
      WHERE p.stock <= COALESCE(pr.low_stock, 10) AND p.is_active = true
    `);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(lowStockResult.rows));
  }

  // ADMIN: NHẬP KHO & ĐIỀU CHỈNH KIỂM KÊ
  if (
    (url.pathname === "/inventory/receive" ||
      url.pathname === "/inventory/adjust") &&
    req.method === "POST"
  ) {
    if (!user || user.role !== "admin") {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Lỗi 403: Chỉ Admin mới được thao tác kho.");
    }

    const body = await parseForm(req);

    if (body.get("csrf") && body.get("csrf") !== session.csrfToken) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Lỗi xác thực CSRF.");
    }

    const productId = parseInt(body.get("product_id"));
    const quantity = parseInt(body.get("quantity"));
    const type =
      url.pathname === "/inventory/receive" ? "IN" : body.get("type");
    const note = body.get("note") || null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await applyStockChange(client, productId, type, quantity, user.id, note);
      await client.query("COMMIT");
      res.writeHead(302, { Location: "/inventory/history" });
      return res.end();
    } catch (err) {
      await client.query("ROLLBACK");
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(`Lỗi thao tác kho: ${err.message}`);
    } finally {
      client.release();
    }
  }

  // ADMIN: XEM LỊCH SỬ KHO
  if (url.pathname === "/inventory/history" && req.method === "GET") {
    if (!user || user.role !== "admin") return false;

    const history = await pool.query(`
      SELECT s.*, p.name as product_name, u.name as user_name FROM public.stock_movements s
      JOIN public.products p ON s.product_id = p.id
      JOIN public.users u ON s.user_id = u.id
      ORDER BY s.created_at DESC LIMIT 100
    `);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(history.rows));
  }

  return false;
}

module.exports = { inventoryRoutes };
