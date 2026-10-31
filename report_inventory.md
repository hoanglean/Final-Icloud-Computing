# Báo Cáo Công Việc: Phân Hệ Quản Lý Kho & Bán Hàng
**Người thực hiện:** Đạt
**Dự án:** Kho Việt

## 1. Tóm tắt công việc đã thực hiện
Đã hoàn thành toàn bộ logic backend cho phân hệ Nhập xuất kho và Bán hàng theo đúng yêu cầu từ tài liệu dự án (Node.js thuần, không sử dụng framework ngoài, kết nối PostgreSQL qua Supabase).

**Các file đã xây dựng/chỉnh sửa:**
- `src/services/inventory.js`: Xây dựng lõi nghiệp vụ cập nhật tồn kho an toàn (`applyStockChange`).
- `src/routes/sales.js`: Xây dựng API xử lý quy trình bán hàng và lịch sử bán của Nhân viên.
- `src/routes/inventory.js`: Xây dựng API xử lý quy trình nhập kho, kiểm kê và cảnh báo tồn cho Admin.
- `src/app.js`: Tích hợp các route mới, truyền `pool` kết nối, cấu hình luồng chặn POST trước `authRoutes` và xác thực bảo mật CSRF thủ công.

## 2. Các chức năng đã hoàn thiện

### A. Dành cho Quản trị viên (Admin)
1. **Nhập kho hàng hóa (`POST /inventory/receive`)**
   - Cộng số lượng sản phẩm vào kho an toàn.
   - Bắt buộc kiểm tra quyền truy cập (Chỉ Admin).
2. **Điều chỉnh kiểm kê (`POST /inventory/adjust`)**
   - Xử lý các trường hợp thất thoát hoặc thừa hàng thực tế.
3. **Xem lịch sử giao dịch toàn hệ thống (`GET /inventory/history` & `GET /admin/sales-history`)**
   - Truy xuất chi tiết biến động kho và lịch sử bán hàng của toàn bộ nhân viên.
4. **Cảnh báo tồn kho thấp (`GET /inventory/low-stock`)**
   - Tự động lọc các sản phẩm có số lượng tồn kho dưới ngưỡng an toàn (mặc định < 10).

### B. Dành cho Nhân viên (Staff)
1. **Bán hàng (`POST /sales`)**
   - Trừ số lượng tồn kho ngay lập tức. Đảm bảo chặn tuyệt đối tài khoản Admin thực hiện chức năng này.
2. **Xem lịch sử bán cá nhân (`GET /sales/history`)**
   - Chỉ được phép truy xuất các giao dịch do chính tài khoản của mình thực hiện.

## 3. Kiến trúc bảo mật và Hiệu suất cốt lõi
- **Chống Race Condition:** Sử dụng cơ chế khóa dòng `FOR UPDATE` trong giao dịch database để đảm bảo số lượng tồn kho không bị sai lệch hoặc rơi vào số âm khi nhiều nhân viên cùng bấm thanh toán một lúc.
- **Xác thực CSRF thủ công:** Toàn bộ các API `POST` thuộc phân hệ này đều được bổ sung mã kiểm tra token CSRF độc lập, đảm bảo an toàn tuyệt đối khi tách khỏi luồng xác thực chung.
- **Quản lý kết nối Database:** Triển khai cơ chế `client.release()` trong khối `finally` cho mọi giao dịch để tối ưu hóa pool kết nối của Supabase.
- **Bảo mật hiển thị:** Các API dành cho nhân viên (ví dụ: cảnh báo tồn thấp) đã được lọc bỏ trường dữ liệu giá gốc (`base_price`), chỉ trả về giá bán hiện tại (`current_price`) theo đúng phân quyền.

## 4. Hướng dẫn kiểm thử (Dành cho Thành viên tích hợp Giao diện)
Hiện tại, các API đang trả về dữ liệu thô (JSON). Thành viên phụ trách UI/UX (Thành viên 1 hoặc 3) tiến hành tích hợp theo các bước sau:

1. **Lấy dữ liệu (GET):** Sử dụng hàm `fetch` để gọi các đường dẫn như `/sales/history` hoặc `/inventory`. Đổ dữ liệu JSON nhận được vào bảng HTML (table).
2. **Gửi dữ liệu (POST):** Các form HTML khi `submit` phải đảm bảo:
   - Thuộc tính `action` trỏ đúng đường dẫn (vd: `/sales`).
   - Có input ẩn truyền token bảo mật: `<input type="hidden" name="csrf" value="<%= session.csrfToken %>">`
   - Phương thức bắt buộc là `POST`.