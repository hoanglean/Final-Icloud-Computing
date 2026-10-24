# Phân chia công việc và phối hợp nhóm Kho Việt

Tài liệu này chia phần việc cho bốn thành viên dựa trên mã nguồn hiện tại. Phân quyền áp dụng: nhân viên bán hàng; admin quản lý và xem lịch sử bán của nhân viên, không tự bán hàng. Thiết kế nghiệp vụ chi tiết nằm trong [PROJECT.md](PROJECT.md); hướng dẫn chạy và tài khoản đăng nhập nằm trong [README.md](../README.md).

## 1 Nền tảng đã có

- Node.js 22 trở lên, dùng HTTP có sẵn và các hàm JavaScript trả HTML. Không dùng Express, EJS hoặc Bootstrap trong bản hiện tại.
- PostgreSQL trên Supabase, truy vấn bằng `pg`; kết nối tại `src/db.js`, tự đọc `.env` qua `src/config/env.js` và xác minh chứng chỉ TLS.
- Đăng nhập, đăng xuất, đổi mật khẩu, CSRF, giới hạn thử mật khẩu và phân quyền tại máy chủ.
- Tài khoản chỉ lưu trong `public.users`, truy cập qua `src/repositories/users-postgres.js`. Hai tài khoản ban đầu đã chuyển lên Supabase; không còn tài khoản JSON hoặc cơ chế tự sinh tài khoản mặc định.
- Thanh chức năng dùng chung theo vai trò tại `src/config/navigation.js` và `src/views/sidebar.js`.
- Bảy bảng nghiệp vụ đã có: `users`, `categories`, `products`, `stock_movements`, `stock_requests`, `pricing_rules`, `price_history`. `schema_migrations` là bảng kỹ thuật, cần giữ lại cho công cụ migration.

Các trang sản phẩm, kho, bán hàng, trả hàng, định giá, báo cáo và quản lý tài khoản hiện chỉ có điều hướng và thông báo đang phát triển. Có bảng dữ liệu và menu chưa có nghĩa là đã hoàn thành các nghiệp vụ này. Phiên đăng nhập và giới hạn thử sai vẫn lưu trong RAM; chưa triển khai công khai lên Render.

## 2 Phân công bốn thành viên

Các file ghi “thêm” dưới đây là vị trí dự kiến, chỉ tạo khi bắt đầu thực hiện chức năng.

| Thành viên | Phần cần hoàn thiện | Vị trí mã nguồn |
| --- | --- | --- |
| 1 | Quản lý tài khoản; sản phẩm, danh mục; duy trì đăng nhập và bảo mật | Có sẵn `src/routes/auth.js`, `src/repositories/users-postgres.js`, `src/middleware/`; thêm `src/routes/users.js`, `products.js`, `categories.js` và repository tương ứng |
| 2 | Nhập kho, bán hàng cho nhân viên, kiểm kê, lịch sử kho, cảnh báo tồn thấp; lịch sử bán cá nhân và lịch sử bán nhân viên cho admin | Thêm `src/routes/inventory.js`, `sales.js`, `src/services/inventory.js` và repository truy vấn kho, giao dịch |
| 3 | Quy tắc định giá, tính lại giá, lịch sử giá; số liệu tổng quan và báo cáo; cấu hình triển khai Render | Thêm `src/routes/pricing.js`, `dashboard.js`, `src/services/pricing.js` và repository báo cáo; phối hợp sửa trang tổng quan hiện có |
| 4 | Gửi và theo dõi yêu cầu trả hàng, hàng hỏng; danh sách duyệt, duyệt hoặc từ chối | Thêm `src/routes/requests.js`, `src/services/requests.js` và repository yêu cầu |

Mỗi thành viên làm cả giao diện, xử lý yêu cầu, truy vấn và kiểm thử cho phần mình. Giao diện đặt trong `src/views/` theo chức năng, kế thừa bố cục và CSS chung; không tạo một ứng dụng hoặc cơ chế đăng nhập riêng.

Người 1 cung cấp sản phẩm và tài khoản để các phần khác tích hợp. Người 2 và 3 thống nhất dịch vụ thay đổi tồn và tính giá trước khi viết luồng giao dịch. Người 4 dùng lại dịch vụ của người 2; không tự viết một luồng cập nhật tồn khác. Người 3 lấy số liệu từ giao dịch đã ghi nhận, không tự tạo dữ liệu doanh thu trong giao diện.

### Người 1 đã làm được gì và còn thiếu gì

**Phần của người 1 chưa hoàn thành.** Hiện mới có nền tảng đăng nhập, phân quyền và kết nối tài khoản; các bảng `users`, `products`, `categories` đã tồn tại nhưng chưa có đầy đủ giao diện và xử lý quản lý.

Đã có:

- Đăng nhập, đăng xuất và đổi mật khẩu cá nhân, lưu mật khẩu băm trên Supabase.
- Đọc tài khoản và cập nhật mật khẩu qua `src/repositories/users-postgres.js`.
- Kiểm tra vai trò, tài khoản đang hoạt động và phiên bản phiên đăng nhập; chống CSRF và giới hạn thử mật khẩu.
- Bố cục chung, thanh chức năng theo quyền và trang chờ cho `/users`, `/products`, `/categories`.
- Kiểm thử đăng nhập, đổi mật khẩu, phân quyền và một số ràng buộc bảng trong database.

Cần làm tiếp:

- [ ] **Quản lý tài khoản:** làm danh sách, tạo tài khoản, gán hoặc đổi vai trò, khóa và mở khóa. Mật khẩu lúc tạo phải băm trước khi lưu; kiểm tra email trùng và dữ liệu đầu vào.
- [ ] **Bảo vệ quyền quản trị:** chặn admin tự khóa mình; chặn khóa hoặc hạ quyền admin hoạt động cuối cùng. Đổi quyền hoặc khóa tài khoản phải tăng `session_version`; phần quản lý này hiện chưa được viết.
- [ ] **Quản lý danh mục:** làm danh sách, thêm, sửa và ngừng sử dụng; kiểm tra tên trùng. Không xóa danh mục còn sản phẩm tham chiếu.
- [ ] **Quản lý sản phẩm:** làm danh sách, tìm kiếm, lọc, thêm, sửa và ngừng kinh doanh; quản lý SKU, tên, danh mục và giá cơ sở. Kiểm tra SKU trùng, danh mục hợp lệ và giá không âm.
- [ ] **Tra cứu dành cho nhân viên:** cho xem giá bán hiện tại, tồn và trạng thái sản phẩm; không trả giá cơ sở hoặc quy tắc định giá trong dữ liệu/giao diện dành cho nhân viên. Các thao tác quản lý chỉ dành cho admin.
- [ ] **Nối sản phẩm với kho và giá:** sản phẩm mới bắt đầu với tồn 0; không sửa tồn trực tiếp qua form sản phẩm. Khi admin đổi giá cơ sở, phối hợp người 3 tính lại giá và ghi lịch sử trong cùng transaction. Nhập tồn đầu kỳ dùng chức năng nhập kho của người 2.
- [ ] **Hoàn thiện các lớp còn thiếu:** thêm route, service khi có nghiệp vụ, repository và giao diện cho tài khoản, sản phẩm, danh mục; đăng ký tại `src/app.js` và thay trang đang phát triển bằng trang thật.
- [ ] **Kiểm thử chức năng mới:** thêm ca tạo/sửa dữ liệu hợp lệ và không hợp lệ, trùng email/SKU/tên danh mục, POST trái quyền, bảo vệ admin cuối cùng, hủy phiên sau khi đổi quyền/khóa và không lộ giá cơ sở cho nhân viên. Kiểm thử hiện tại chưa thay thế các ca này.

Trước khi triển khai công khai, người 1 còn phối hợp người 3 chuyển phiên và giới hạn đăng nhập khỏi RAM, cấu hình cookie phù hợp HTTPS. Đây là phần hoàn thiện bảo mật triển khai, tách với các màn hình quản lý còn thiếu ở trên.

## 3 Quyền và phạm vi dữ liệu

| Chức năng hoặc đường dẫn | Admin | Nhân viên |
| --- | --- | --- |
| `/products`, `/inventory/low-stock` | Xem và quản lý sản phẩm theo chức năng | Tra cứu giá bán, tồn, cảnh báo; không thấy giá cơ sở hoặc quy tắc |
| `/categories`, `/users` | Quản lý | Không được truy cập |
| `/inventory/receive`, `/inventory/adjust`, `/inventory/history` | Nhập kho, kiểm kê, xem lịch sử | Không được truy cập |
| `/sales` | Không được bán hàng | Được bán hàng |
| `/sales/history` | Không có lịch sử bán cá nhân | Chỉ xem giao dịch do mình tạo |
| `/admin/sales-history` | Xem lịch sử bán của nhân viên; nằm trong nhóm Quản trị | Không được truy cập |
| `/requests/return`, `/requests/damage` | Được gửi yêu cầu | Được gửi yêu cầu; trả hàng phải gắn với giao dịch bán của mình |
| `/requests` | Xem mọi yêu cầu, duyệt hoặc từ chối | Chỉ xem yêu cầu mình gửi |
| `/pricing`, `/pricing/history`, `/reports` | Quản lý giá và xem báo cáo | Không được truy cập |

Vai trò và người thực hiện lấy từ `context.user`. Không tin `role`, `user_id`, người duyệt hoặc trạng thái do trình duyệt gửi lên. Truy vấn lịch sử của nhân viên phải lọc theo ID tài khoản đang đăng nhập, không chỉ ẩn dữ liệu ở giao diện.

Chức năng chỉ dành cho admin có thể dùng `hasRole(user, 'admin')`. Bán hàng phải kiểm tra chính xác `user.role === 'staff'`; không dùng `hasRole(user, 'staff')` vì helper hiện tại cho phép cả admin. Kiểm tra quyền trên từng thao tác ở máy chủ, kể cả khi người dùng tự gửi POST hoặc nhập trực tiếp đường dẫn.

Khi làm quản lý tài khoản, không cho admin tự khóa mình hoặc hạ quyền admin cuối cùng. Đổi quyền hoặc khóa tài khoản phải tăng `session_version` để phiên cũ hết hiệu lực; đổi mật khẩu hiện đã có cơ chế này.

## 4 Cách ghép chức năng vào ứng dụng

1. Đặt xử lý request trong `src/routes/`, nghiệp vụ trong `src/services/` và truy vấn trong `src/repositories/`. Dùng tham số `$1`, `$2` của `pg` cho dữ liệu người dùng.
2. Đăng ký route tại `src/app.js` theo cả phương thức và đường dẫn. Hiện mọi POST đều chuyển vào `authRoutes`; khi thêm POST nghiệp vụ, phải phân luồng trước để tránh rơi vào xử lý xác thực rồi nhận 404.
3. Các GET nghiệp vụ hiện được `src/routes/pages.js` trả về trang đang phát triển. Khi làm chức năng thật, thay nhánh tương ứng hoặc xử lý trước nhánh trang chờ; không để trang chờ che mất chức năng đã viết.
4. Dùng pool đã tạo trong `createApp`, không tạo pool ở từng request. Nếu route cần transaction, bổ sung pool vào context hoặc truyền repository phù hợp; context hiện chưa chứa pool.
5. Route thay đổi dữ liệu phải kiểm tra đăng nhập, quyền, CSRF và dữ liệu đầu vào. CSRF hiện được kiểm tra trong `authRoutes`; route mới không tự được bảo vệ khi nằm ngoài hàm này.
6. Khi trả trang, dùng `send` và truyền đường dẫn hiện tại vào tham số cuối để thanh bên đánh dấu đúng mục. Escape nội dung người dùng trước khi chèn vào HTML.
7. Khai báo menu tại `src/config/navigation.js`; chỉ sửa `src/views/sidebar.js`, `src/views/layout.js` hoặc CSS chung khi cần đổi bố cục dùng chung.

## 5 Thống nhất nghiệp vụ giữa bốn thành viên

Các dịch vụ dưới đây là phần cần xây dựng, chưa có trong mã nguồn hiện tại:

- Người 1 làm nghiệp vụ quản lý tài khoản, sản phẩm và danh mục; bổ sung các phương thức còn thiếu trong repository tài khoản và thêm repository sản phẩm, danh mục. Khi cần, thêm `src/services/users.js`, `products.js`, `categories.js` để xử lý quy tắc nghiệp vụ. Sản phẩm mới có tồn 0; đổi giá cơ sở phải phối hợp gọi hàm tính giá của người 3 trong cùng transaction, không tự cập nhật tồn kho. Chi tiết phần đã có và còn thiếu nằm ở mục 2.
- Người 2 làm `applyStockChange` trong `src/services/inventory.js` cho IN, SALE, RETURN, ADJUST_IN, ADJUST_OUT và DAMAGE. Dịch vụ khóa sản phẩm, kiểm tra điều kiện, cập nhật tồn, ghi giao dịch rồi gọi tính giá.
- Người 3 làm hàm tính lại giá trong `src/services/pricing.js`, nhận cùng client transaction. Luôn tính từ `base_price`, chặn trong khoảng min/max, làm tròn đến đồng và chỉ ghi `price_history` khi giá đổi.
- Người 4 làm luồng duyệt yêu cầu trong `src/services/requests.js`, khóa và kiểm tra PENDING trước khi gọi dịch vụ thay đổi tồn; cập nhật trạng thái và liên kết giao dịch trong cùng transaction.

Mỗi thao tác dùng một client với BEGIN, COMMIT hoặc ROLLBACK và luôn release. Các dịch vụ phối hợp trong một thao tác phải dùng cùng client; không tự COMMIT một phần rồi mới cập nhật phần còn lại. Thống nhất thứ tự khóa giữa các luồng cùng sửa tồn hoặc giá.

SALE lưu đơn giá trước khi trừ tồn; giá tính lại dùng cho lần bán tiếp theo. RETURN dùng giá bán gốc và không được trả vượt số lượng đã bán. Doanh thu là SALE trừ RETURN; DAMAGE và điều chỉnh kiểm kê không tính vào doanh thu. Yêu cầu PENDING hoặc REJECTED không làm đổi tồn, giá hay doanh thu.

Database đã có các ràng buộc và trigger kiểm tra người tạo giao dịch, trả hàng, trạng thái duyệt và lịch sử kho không sửa/xóa. Những kiểm tra này không tự cập nhật `products.stock` hoặc tính giá; dịch vụ vẫn phải hoàn thiện transaction và kiểm tra nghiệp vụ.

## 6 Cơ sở dữ liệu và phối hợp thay đổi

- Chạy dự án theo README. `.env` là cấu hình riêng của từng máy; bắt buộc có `DATABASE_URL`. Không tạo lại `data/users.json` hoặc lệnh seed tài khoản local.
- Không đưa chuỗi kết nối thật, mật khẩu database hoặc mật khẩu băm lên Git. Thông tin đăng nhập dùng cho đồ án được ghi trong README theo cấu hình hiện tại, không cần chép thêm vào TEAM.md.
- Không sửa `database/migrations/001_inventory_pricing.sql` đã áp dụng. Thống nhất với nhóm trước khi thêm migration mới, đánh số tiếp theo và chạy `npm run db:migrate`; xác minh bằng `npm run db:check`.
- Không xóa `schema_migrations`. Công cụ dùng bảng này và checksum để tránh áp dụng trùng hoặc sửa lại migration cũ.
- Các bảng bật RLS và chặn truy cập trực tiếp của vai trò trình duyệt. Kết nối PostgreSQL của máy chủ vẫn cần kiểm tra quyền và phạm vi dữ liệu tại ứng dụng; RLS hiện không tự phân biệt admin/nhân viên của Kho Việt.
- Kiểm thử và dữ liệu thử dùng PostgreSQL qua PGlite, không ghi giao dịch giả vào Supabase đang dùng chung. Khi cần dữ liệu demo trên Supabase, nhóm thống nhất riêng dữ liệu và người thực hiện.

## 7 Kiểm thử và thứ tự tích hợp

Hiện có `tests/auth.test.js`, `tests/navigation.test.js` và `tests/database.test.js`, kiểm tra đăng nhập qua repository PostgreSQL, phân quyền và các ràng buộc SQL. Thêm kiểm thử trong `tests/` theo phần việc; `npm test` tự chạy các file `*.test.js`.

| Người phụ trách | Các ca cần kiểm tra khi hoàn thiện |
| --- | --- |
| 1 | SKU/email trùng; dữ liệu không hợp lệ; nhân viên không sửa dữ liệu quản trị; đổi quyền/khóa làm mất hiệu lực phiên; bảo vệ admin cuối cùng |
| 2 | Tồn không âm; bán vượt tồn; admin không bán được; nhân viên không xem lịch sử người khác; hai giao dịch đồng thời không bán quá số hàng |
| 3 | Giá ở đúng ngưỡng thấp/cao; min/max; quy tắc tắt; không tăng giảm cộng dồn; lịch sử chỉ ghi khi giá đổi; doanh thu trừ hoàn trả |
| 4 | Gửi hoặc từ chối không đổi tồn; chỉ admin duyệt; không duyệt hai lần; trả không vượt số đã bán; hàng hỏng không vượt tồn; lỗi thì rollback toàn bộ |

Thứ tự tích hợp: sản phẩm và tài khoản → dịch vụ kho và định giá → nhập kho, bán hàng → yêu cầu và duyệt → lịch sử, báo cáo → hoàn thiện triển khai. Các thành viên có thể làm giao diện và kiểm thử phần mình trong lúc chờ dịch vụ phụ thuộc.

Mỗi người làm nhánh Git theo tính năng và chạy `npm test` trước khi gộp. Khi cùng sửa `src/app.js`, navigation, CSS hoặc migration, thống nhất người ghép để tránh ghi đè. Trước khi đánh dấu hoàn thành, kiểm tra cả vai trò admin và nhân viên, đường dẫn trực tiếp, POST trái quyền và luồng lỗi; không chỉ kiểm tra menu hiển thị.
