# BÁO CÁO KỸ THUẬT & HƯỚNG DẪN TRIỂN KHAI — THÀNH VIÊN 3 (MEMBER 3)

**Dự án:** Kho Việt — Inventory Management and Dynamic Pricing System  
**Thành viên phụ trách:** Lê Cảm — Thành viên 3 (Member 3)  
**Nhánh Git:** `feature/member-3-pricing-dashboard`  
---

## 1. PHẠM VI TRÁCH NHIỆM CỦA THÀNH VIÊN 3

Theo phân công đồ án Kho Việt, Thành viên 3 chịu trách nhiệm thiết kế, xây dựng và tích hợp các trụ cột nghiệp vụ:
1. **Dịch vụ định giá động (Dynamic Pricing Service):** Tự động điều chỉnh giá bán theo lượng tồn kho, giá cơ sở, và quy tắc định giá.
2. **Quản lý quy tắc định giá (Pricing Rules Management):** Giao diện và API quản trị quy tắc định giá cho từng sản phẩm.
3. **Lịch sử biến động giá (Price History Tracking):** Theo dõi toàn bộ các lần thay đổi giá bán, chênh lệch và nguyên nhân.
4. **Tổng quan (Admin Dashboard) & Báo cáo kinh doanh (Business Reports):** Thống kê số lượng tồn, giá trị vốn kho hàng, doanh thu thuần thực tế (`SALE` &minus; `RETURN`), loại trừ các giao dịch hàng hỏng và kiểm kê.
5. **Cấu hình Cloud & Triển khai Render:** Chuẩn bị tệp cấu hình Blueprint `render.yaml`, xử lý host binding `0.0.0.0`, và hướng dẫn triển khai hệ thống an toàn.
6. **Kiểm thử tự động & Tích hợp:** Xây dựng các bộ test tự động độc lập, đảm bảo bảo toàn 100% các tính năng hiện có của các thành viên khác.

---

## 2. DANH SÁCH TÍNH NĂNG ĐÃ HOÀN THIỆN (FEATURE INVENTORY)

| STT | Chức năng | Đường dẫn (Route) | Phân quyền | Trạng thái |
|---|---|---|---|---|
| 1 | Danh sách quy tắc định giá theo sản phẩm | `GET /pricing` | Admin | ✅ Hoàn thành |
| 2 | Bộ lọc & tìm kiếm quy tắc giá (tên, ID, danh mục, trạng thái, mức tồn) | `GET /pricing?q=...&category=...` | Admin | ✅ Hoàn thành |
| 3 | Biểu mẫu cấu hình quy tắc định giá | `GET /pricing/:productId/edit` | Admin | ✅ Hoàn thành |
| 4 | Lưu / Cập nhật quy tắc định giá | `POST /pricing/:productId` | Admin + CSRF | ✅ Hoàn thành |
| 5 | Bật / Tắt quy tắc định giá nhanh | `POST /pricing/:productId/toggle` | Admin + CSRF | ✅ Hoàn thành |
| 6 | Tính lại giá bán sản phẩm thủ công | `POST /pricing/:productId/recalculate` | Admin + CSRF | ✅ Hoàn thành |
| 7 | Tra cứu Lịch sử biến động giá | `GET /pricing/history` | Admin | ✅ Hoàn thành |
| 8 | Dashboard tổng quan KPI kinh doanh | `GET /admin` | Admin | ✅ Hoàn thành |
| 9 | Báo cáo doanh thu & biến động giá | `GET /reports` | Admin | ✅ Hoàn thành |
| 10 | Lọc báo cáo theo khoảng thời gian | `GET /reports?period=...` | Admin | ✅ Hoàn thành |
| 12 | Tích hợp giao dịch kho tự động tính giá | Service layer (`recalculatePrice`) | Hệ thống | ✅ Hoàn thành |
| 13 | Cấu hình triển khai Cloud Render | `render.yaml`, `src/server.js` | Hệ thống | ✅ Hoàn thành |

---

## 3. KIẾN TRÚC NGHIỆP VỤ & NGUYÊN TẮC THIẾT KẾ

### 3.1. Thuật toán định giá động (Dynamic Pricing Algorithm)
- **Gốc tính giá bất biến:** Giá tính toán luôn xuất phát từ **Giá cơ sở ban đầu (`products.base_price`)**, tuyệt đối **không** tính từ giá hiện tại (`current_price`) để loại bỏ hoàn toàn hiện tượng cộng dồn trượt giá (compounding price drift) khi thực hiện nhiều giao dịch liên tiếp.
- **Quy tắc tính:**
  - Nếu quy tắc chưa có hoặc đang bị tắt (`enabled = false`):
    > `Giá bán = base_price`
  - Nếu tồn kho khan hiếm (`stock <= low_stock`):
    > `Giá thô = base_price * (1 + increase_percent / 100)`
  - Nếu tồn kho dư thừa (`stock >= high_stock`):
    > `Giá thô = base_price * (1 - discount_percent / 100)`
  - Nếu tồn kho trong khoảng bình thường (`low_stock < stock < high_stock`):
    > `Giá thô = base_price`
- **Chặn biên độ an toàn (Clamping):**
  > `Giá khống chế = min(max_price, max(min_price, Giá thô))`
- **Làm tròn tiền tệ VND:** Làm tròn đến đơn vị đồng nguyên `round(...)`, chặn tối đa mức cực đại của `NUMERIC(14,2)` là `999.999.999.999` đồng.

### 3.2. Tính toàn vẹn giao dịch (Atomic Shared Transactions)
- Hàm `recalculatePrice(client, productId, changedBy, reason)` nhận client PostgreSQL đang mở giao dịch (`BEGIN`) từ bên ngoài (Orchestrator).
- Khi Thành viên 1 đổi giá cơ sở (`saveProduct`) hoặc Thành viên 2 ghi nhận giao dịch kho (`applyStockChange`), hàm `recalculatePrice` được gọi trong **cùng transaction client**.
- Nếu việc ghi nhận giá bán hoặc lịch sử giá gặp lỗi, toàn bộ transaction (kể cả việc trừ tồn kho hay sửa sản phẩm) sẽ bị `ROLLBACK` ngay lập tức, ngăn ngừa dữ liệu dở dang hoặc sai lệch số lượng.
- Chỉ cập nhật `current_price` và chỉ ghi bản ghi mới vào `public.price_history` khi và chỉ khi: `old_price != new_price`.

### 3.3. Công thức Báo cáo Doanh thu thuần (Net Revenue Formulation)
Doanh thu kinh doanh được tính toán nghiêm ngặt dựa trên dữ liệu giao dịch thật trong bảng `stock_movements`:
- **Doanh thu bán gộp (Gross Sales):**
  > `Gross Sales = Tổng (quantity * unit_price) của tất cả giao dịch type = 'SALE'`
- **Giá trị hàng hoàn trả (Returns):**
  > `Returns = Tổng (quantity * unit_price) của tất cả giao dịch type = 'RETURN'`
- **Doanh thu thuần (Net Revenue):**
  > `Net Revenue = Gross Sales - Returns`

**Nguyên tắc loại trừ bất biến:**
- Hàng hỏng (`DAMAGE`) là chi phí hao hụt kho hàng, tuyệt đối **không** được tính vào doanh thu hay hàng trả lại.
- Các giao dịch kiểm kê cân đối tồn (`ADJUST_IN`, `ADJUST_OUT`) tuyệt đối **không** được tính vào doanh thu bán lẻ.
- Các yêu cầu trả hàng đang chờ duyệt (`PENDING`) hoặc đã từ chối (`REJECTED`) của Thành viên 4 **không** ảnh hưởng tới số liệu báo cáo tài chính cho tới khi được Admin duyệt thành giao dịch kho chính thức.

### 3.4. Định nghĩa Định giá vốn tồn kho trên Dashboard
- Sử dụng **Giá cơ sở (`base_price`)** làm chuẩn đo lường:
  > `Tổng giá trị vốn tồn kho = Tổng (stock * base_price) của các sản phẩm đang hoạt động (is_active = true)`  
  *(Lý do: Giá cơ sở phản ánh đúng giá trị vốn tài sản nhập của cửa hàng, ổn định và không bị bóp méo bởi quy luật tăng giảm giá theo cung cầu ngắn hạn).*

---

## 4. HƯỚNG DẪN TRIỂN KHAI LÊN CLOUD RENDER (RENDER DEPLOYMENT GUIDE)

Dự án đã sẵn sàng 100% để triển khai lên nền tảng đám mây Render (PaaS) kết nối trực tiếp với PostgreSQL trên Supabase.

### 4.1. Chuẩn bị trước khi triển khai
1. Mã nguồn trên nhánh `feature/member-3-pricing-dashboard` đã có sẵn file cấu hình Blueprint [`render.yaml`](../render.yaml) và file chứng chỉ CA [`database/certs/supabase-ca.crt`](../database/certs/supabase-ca.crt).
2. Chuỗi kết nối PostgreSQL Supabase (Session pooler port 6543 hoặc Direct port 5432).

### 4.2. Các bước triển khai trên Render Dashboard:
1. Đăng nhập vào [Render.com](https://render.com).
2. Bấm nút **New +** &rarr; chọn **Web Service** (hoặc chọn **Blueprint** và chọn repo GitHub của dự án).
3. Kết nối với repository GitHub: `Final-Icloud-Computing`.
4. Điền các thông số cơ bản (nếu tạo Web Service thủ công):
   - **Name:** `kho-viet`
   - **Region:** `Singapore (Southeast Asia)`
   - **Branch:** `feature/member-3-pricing-dashboard` (hoặc `main` sau khi merge)
   - **Runtime:** `Node`
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
5. **Cấu hình Biến môi trường (Environment Variables) trong mục "Advanced":**
   | Key | Value | Ghi chú |
   |---|---|---|
   | `NODE_VERSION` | `22` | Bắt buộc Node.js version 22 trở lên |
   | `HOST` | `0.0.0.0` | Để server nhận traffic từ Reverse Proxy của Render |
   | `PORT` | `10000` | Cổng mặc định của Render |
   | `SUPABASE_PROJECT_REF` | `Mã_Project_Supabase` | Mã định danh dự án trên Supabase |
   | `DATABASE_URL` | `postgresql://...` | Chuỗi kết nối Supabase có chứa mật khẩu |
   | `DATABASE_SSL_CA_FILE` | `database/certs/supabase-ca.crt` | Xác thực chứng chỉ TLS an toàn |
6. Bấm **Create Web Service**.
7. Render sẽ tự động pull code, chạy `npm ci`, và khởi chạy `npm start`. Khi màn hình console hiện `Kho Viet: http://0.0.0.0:10000` là ứng dụng đã online công khai trên internet!

---

## 5. BẰNG CHỨNG KIỂM THỬ TỰ ĐỘNG (TEST VERIFICATION MATRIX)

Hệ thống kiểm thử tự động sử dụng Node.js Test Runner kết hợp cơ sở dữ liệu in-memory PostgreSQL (`PGlite`), hoàn toàn độc lập với môi trường production:
- **Lệnh chạy kiểm thử:**
  ```powershell
  npm test
  ```
- **Kết quả tổng thể:** **91 / 91 tests PASS (100% Đạt, 0 Lỗi)**.

### Chi tiết các ca kiểm thử thuộc phạm vi Thành viên 3:
| Tệp kiểm thử | Tên ca kiểm thử | Kết quả |
|---|---|---|
| `tests/pricing.test.js` | Tính giá tăng khi tồn kho ≤ ngưỡng thấp (`low_stock`) | ✅ PASS |
| `tests/pricing.test.js` | Tính giá giảm khi tồn kho ≥ ngưỡng cao (`high_stock`), chặn bởi `min_price` | ✅ PASS |
| `tests/pricing.test.js` | Chặn giá tối đa theo giá trần `max_price` khi % tăng vượt giới hạn | ✅ PASS |
| `tests/pricing.test.js` | Tắt quy tắc giá tự động trả về `base_price`; bật lại áp dụng theo tồn kho | ✅ PASS |
| `tests/pricing.test.js` | Tính giá nhiều lần không bị cộng dồn giá (no compounding) và không sinh lịch sử thừa | ✅ PASS |
| `tests/pricing.test.js` | Chặn tài khoản nhân viên (staff) không được cấu hình quy tắc định giá | ✅ PASS |
| `tests/pricing.test.js` | Validation đầu vào nghiêm ngặt (`low_stock < high_stock`, % hợp lệ, `min <= max`) | ✅ PASS |
| `tests/pricing.test.js` | Rollback giao dịch nguyên tử khi lưu quy tắc bị lỗi ghi lịch sử | ✅ PASS |
| `tests/pricing.test.js` | Cấu trúc dữ liệu Repository trả về đầy đủ sản phẩm và quy tắc giá | ✅ PASS |
| `tests/pricing.test.js` | Lọc dữ liệu quy tắc giá theo từ khóa tìm kiếm, danh mục, trạng thái quy tắc và mức tồn kho | ✅ PASS |
| `tests/pricing.test.js` | Chặn khách chưa đăng nhập và nhân viên truy cập route `/pricing` (HTTP 403) | ✅ PASS |
| `tests/pricing.test.js` | Admin truy cập giao diện thật `/pricing` và `/pricing/history` (không bị placeholder) | ✅ PASS |
| `tests/pricing.test.js` | Lưu quy tắc qua HTTP POST với token CSRF và áp dụng giá mới ngay | ✅ PASS |
| `tests/pricing.test.js` | Thao tác HTTP Bật/Tắt quy tắc và Tính lại giá thủ công hoạt động chuẩn xác | ✅ PASS |
| `tests/pricing.test.js` | Lọc danh sách quy tắc định giá qua query parameters trên HTTP GET `/pricing` | ✅ PASS |
| `tests/pricing.test.js` | Kiểm soát HTTP Methods (trả về 405 Method Not Allowed cho method sai) | ✅ PASS |
| `tests/reports.test.js` | Tính toán chính xác các chỉ số KPI Dashboard (Tổng SP, Tồn kho, Giá trị vốn) | ✅ PASS |
| `tests/reports.test.js` | Tính Doanh thu thuần = `SALE` &minus; `RETURN`; loại trừ `DAMAGE` và `ADJUST_*` | ✅ PASS |
| `tests/reports.test.js` | Xử lý an toàn khi tập dữ liệu rỗng (trả về 0đ sạch sẽ, không lỗi NaN) | ✅ PASS |
| `tests/reports.test.js` | Thống kê tần suất và biên độ thay đổi giá của từng sản phẩm | ✅ PASS |
| `tests/reports.test.js` | Chặn nhân viên và khách truy cập Dashboard Admin `/admin` và `/reports` | ✅ PASS |
| `tests/reports.test.js` | Admin xem giao diện báo cáo thật kèm bộ lọc khoảng thời gian (`period`, `from_date`, `to_date`) | ✅ PASS |

---

## 6. DANH MỤC TỆP TIN THUỘC PHẠM VI THÀNH VIÊN 3

### Các tệp tạo mới (100% New Files - Không ảnh hưởng ai):
1. `docs/MEMBER_3.md` (Báo cáo kỹ thuật và hướng dẫn triển khai riêng biệt).
2. `render.yaml` (Cấu hình Blueprint triển khai Cloud Render).
3. `src/repositories/pricing.js` (Repository quản lý bảng `pricing_rules` và `price_history`).
4. `src/repositories/reports-postgres.js` (Repository truy vấn tổng hợp Dashboard và Doanh thu).
5. `src/routes/pricing.js` (Route điều hướng quản trị giá và lịch sử giá).
6. `src/routes/dashboard.js` (Route điều hướng Dashboard Admin và Báo cáo kinh doanh).
7. `src/views/pricing/rules.js` (Giao diện danh sách quy tắc giá).
8. `src/views/pricing/rule-form.js` (Giao diện biểu mẫu cấu hình quy tắc).
9. `src/views/pricing/history.js` (Giao diện bảng lịch sử biến động giá).
10. `src/views/pricing/index.js` (Module tập trung xuất các view định giá).
11. `src/views/reports/index.js` (Giao diện báo cáo doanh thu và biến động giá).
12. `tests/pricing.test.js` (Bộ kiểm thử tự động định giá động).
13. `tests/reports.test.js` (Bộ kiểm thử tự động Dashboard và Báo cáo).

### Các tệp dùng chung được chỉnh sửa tối thiểu:
1. `src/services/pricing.js`: Bổ sung các hàm quản trị quy tắc (`savePricingRule`, `togglePricingRule`, `recalculateProductPriceManually`); **bảo toàn nguyên vẹn 100% hàm `recalculatePrice` cũ** đang được Thành viên 1 và 2 gọi.
2. `src/views/dashboard/home.js`: Mở rộng hiển thị thẻ thống kê KPI cho Quản trị viên (`admin`); **giữ nguyên vẹn 100% giao diện chào mừng cũ** cho Nhân viên (`staff`).
3. `src/app.js`: Đăng ký thêm `pricingRoutes` và `dashboardRoutes` trước `pageRoutes`; không đụng chạm đến route của các thành viên khác.
4. `src/server.js`: Hỗ trợ biến môi trường `HOST || '0.0.0.0'` phục vụ Cloud Render.
5. `package.json`: Cập nhật cờ `--test-concurrency=1` trong lệnh test để bảo đảm chạy ổn định trên mọi môi trường.

