const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { hashPassword } = require("./services/password");
const { sessions } = require("./services/session");
const { resolveAuth } = require("./middleware/auth");
const { securityHeaders } = require("./middleware/security");
const { authRoutes } = require("./routes/auth");
const { pageRoutes } = require("./routes/pages");
const { createPool } = require("./db");
const {
  createPostgresUserRepository,
} = require("./repositories/users-postgres");
const { salesRoutes } = require("./routes/sales");
const { inventoryRoutes } = require("./routes/inventory");

async function createApp({ pool = createPool() } = {}) {
  const root = path.join(__dirname, "..");
  const userRepository = createPostgresUserRepository(pool);
  try {
    await userRepository.all();
  } catch (error) {
    await pool.end();
    throw error;
  }

  const dummyHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
  const attempts = new Map();
  const cleanup = setInterval(() => {
    for (const [id, s] of sessions)
      if (s.expires < Date.now()) sessions.delete(id);
    for (const [id, a] of attempts)
      if (a.until < Date.now()) attempts.delete(id);
  }, 60000);
  cleanup.unref();

  const server = http.createServer(async (req, res) => {
    securityHeaders(res); // Bức tường lửa (Nếu test bị lỗi CSP thì tạm thời comment dòng này lại)
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/style.css" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        return res.end(
          fs.readFileSync(path.join(root, "public/css/style.css"))
        );
      }

      const users = await userRepository.all();
      // Bổ sung `pool` vào biến context để các route con sử dụng
      const context = {
        url,
        ...resolveAuth(req, res, users),
        users,
        userRepository,
        attempts,
        dummyHash,
        pool,
      };

      // >>> CHÈN THÊM ĐOẠN GIAO DIỆN TEST VÀO ĐÂY <<<
      if (url.pathname === "/test-ui" && req.method === "GET") {
        const csrfToken = context.session?.csrfToken || "";
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(`
          <div style="font-family: sans-serif; padding: 20px; max-width: 500px; margin: auto;">
            <h2>Giao diện Test Nhanh Nghiệp Vụ Kho</h2>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <h3>1. Nhập kho (Dành cho Admin)</h3>
              <form action="/inventory/receive" method="POST">
                <!-- Tự động nhúng token bảo mật CSRF -->
                <input type="hidden" name="csrf" value="${csrfToken}">
                ID Sản phẩm: <input name="product_id" value="1" readonly style="width: 50px;"><br><br>
                Số lượng: <input type="number" name="quantity" value="50"><br><br>
                <button type="submit" style="padding: 5px 15px; cursor: pointer;">Nhập hàng vào kho</button>
              </form>
            </div>

            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px;">
              <h3>2. Bán hàng (Dành cho Nhân viên)</h3>
              <form action="/sales" method="POST">
                <!-- Tự động nhúng token bảo mật CSRF -->
                <input type="hidden" name="csrf" value="${csrfToken}">
                ID Sản phẩm: <input name="product_id" value="1" readonly style="width: 50px;"><br><br>
                Số lượng: <input type="number" name="quantity" value="2"><br><br>
                <button type="submit" style="padding: 5px 15px; cursor: pointer;">Bán hàng</button>
              </form>
            </div>
          </div>
        `);
      }
      // >>> KẾT THÚC ĐOẠN GIAO DIỆN TEST <<<
      
      // 1. CHẶN LUỒNG KHO & BÁN HÀNG (Ưu tiên xử lý trước)
      if ((await salesRoutes(req, res, context)) !== false) return;
      if ((await inventoryRoutes(req, res, context)) !== false) return;

      // 2. AuthRoutes (Xử lý các POST còn lại như đăng nhập, đổi pass)
      if (req.method === "POST") return await authRoutes(req, res, context);

      // 3. PageRoutes (Xử lý trả về giao diện)
      return pageRoutes(req, res, context);
    } catch (error) {
      console.error(error.message);
      if (!res.headersSent)
        res.writeHead(error.message === "FORM_TOO_LARGE" ? 413 : 500, {
          "Content-Type": "text/plain; charset=utf-8",
        });
      res.end("Không thể xử lý yêu cầu. Vui lòng thử lại.");
    }
  });

  server.on("close", () => {
    clearInterval(cleanup);
    pool.end().catch(() => {});
  });
  return server;
}

module.exports = { createApp };
