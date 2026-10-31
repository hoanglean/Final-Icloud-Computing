# Phân chia công việc và phối hợp nhóm Kho Việt

Tài liệu này chia phần việc cho bốn thành viên dựa trên mã nguồn hiện tại. Phân quyền áp dụng: nhân viên bán hàng; admin quản lý và xem lịch sử bán của nhân viên, không tự bán hàng. Thiết kế nghiệp vụ chi tiết nằm trong [PROJECT.md](PROJECT.md); hướng dẫn chạy và tài khoản đăng nhập nằm trong [README.md](../README.md).

**Cập nhật ngày 31/10/2026**, theo mã nguồn của nhánh đang đọc. Hoàn thiện và kiểm thử trên nhánh tính năng chưa đồng nghĩa đã gộp vào `main`. PROJECT.md và tài liệu Word có thể còn mô tả tiến độ cũ; dùng README và tài liệu này để theo dõi phần đã có/còn thiếu.

## 1 Nền tảng đã có

- Node.js 22 trở lên, dùng HTTP có sẵn và các hàm JavaScript trả HTML. Không dùng Express, EJS hoặc Bootstrap trong bản hiện tại.
- PostgreSQL trên Supabase, truy vấn bằng `pg`; kết nối tại `src/db.js`, tự đọc `.env` qua `src/config/env.js` và xác minh chứng chỉ TLS.
- Đăng nhập, đăng xuất, đổi mật khẩu, CSRF, giới hạn thử mật khẩu và phân quyền tại máy chủ.
- Tài khoản chỉ lưu trong `public.users`, truy cập qua `src/repositories/users-postgres.js`. Hai tài khoản ban đầu đã chuyển lên Supabase; không còn tài khoản JSON hoặc cơ chế tự sinh tài khoản mặc định.
- Thanh chức năng dùng chung theo vai trò tại `src/config/navigation.js` và `src/views/sidebar.js`.
- Bảy bảng nghiệp vụ đã có: `users`, `categories`, `products`, `stock_movements`, `stock_requests`, `pricing_rules`, `price_history`. `schema_migrations` là bảng kỹ thuật, cần giữ lại cho công cụ migration.

Đã có giao diện và xử lý cho tài khoản, danh mục, sản phẩm/ảnh, nhập kho, kiểm kê, bán hàng, lịch sử kho/bán và cảnh báo tồn thấp. Hàm tính lại giá dùng chung đã tích hợp vào đổi giá cơ sở và thay đổi tồn. Các trang yêu cầu trả hàng/hàng hỏng, duyệt yêu cầu, quản lý quy tắc giá, lịch sử giá và báo cáo còn là trang đang phát triển. Phiên đăng nhập và giới hạn thử sai vẫn lưu trong RAM; chưa triển khai công khai lên Render.

## 2 Phân công bốn thành viên

Giữ nguyên phạm vi bốn thành viên; ưu tiên dùng lại các phần đã có thay vì viết lại. Các file ghi “cần thêm” chưa có trong mã nguồn hiện tại.

| Thành viên | Tiến độ và phần cần hoàn thiện | Vị trí mã nguồn |
| --- | --- | --- |
| 1 | Đã có các chức năng chính: tài khoản, sản phẩm/ảnh, danh mục, xác thực và phân quyền; phối hợp hoàn thiện bảo mật triển khai | `src/routes/auth.js`, `users.js`, `products.js`, `categories.js`; service, repository, view và kiểm thử tương ứng |
| 2 | Đã có các chức năng chính: nhập kho, bán hàng, kiểm kê, lịch sử kho/bán và cảnh báo tồn; cần duyệt tích hợp và kiểm tra khóa trên nhiều kết nối PostgreSQL thật | `src/routes/inventory.js`, `sales.js`, `src/services/inventory.js`, `src/repositories/inventory.js`, `src/views/stock/index.js`, `tests/inventory-sales.test.js` |
| 3 | Đã có hàm tính lại giá; còn quản lý quy tắc, màn hình lịch sử giá, tổng quan, báo cáo và Render | Dùng lại `src/services/pricing.js`; cần thêm route/view cho giá, báo cáo và repository báo cáo; phối hợp sửa tổng quan |
| 4 | Đã có bảng/ràng buộc và dịch vụ kho hỗ trợ RETURN/DAMAGE; chưa có luồng gửi, theo dõi, duyệt/từ chối | Cần thêm `src/routes/requests.js`, `src/services/requests.js`, repository, view và kiểm thử yêu cầu |

Mỗi thành viên làm cả giao diện, xử lý yêu cầu, truy vấn và kiểm thử cho phần mình. Giao diện đặt trong `src/views/` theo chức năng, kế thừa bố cục và CSS chung; không tạo một ứng dụng hoặc cơ chế đăng nhập riêng.

Người 1 đã cung cấp sản phẩm và tài khoản cho các phần khác tích hợp. Người 2 đã gọi hàm tính giá của người 3 trong cùng transaction thay đổi tồn. Người 4 dùng lại dịch vụ của người 2; không tự viết một luồng cập nhật tồn khác. Người 3 lấy số liệu từ giao dịch đã ghi nhận, không tự tạo dữ liệu doanh thu trong giao diện.

### Người 1 đã làm được gì và còn thiếu gì

**Các chức năng chính của người 1 đã có và được kiểm thử.** Phần còn lại chủ yếu là phối hợp khi tích hợp và triển khai công khai.

Đã có:

- Đăng nhập, đăng xuất và đổi mật khẩu cá nhân, lưu mật khẩu băm trên Supabase.
- Đọc tài khoản và cập nhật mật khẩu qua `src/repositories/users-postgres.js`.
- Kiểm tra vai trò, tài khoản đang hoạt động và phiên bản phiên đăng nhập; chống CSRF và giới hạn thử mật khẩu.
- Quản lý tài khoản: danh sách, tạo, đổi vai trò, khóa/mở khóa; kiểm tra email trùng, tự khóa và admin hoạt động cuối cùng. Thay đổi quyền/trạng thái làm mất hiệu lực phiên cũ.
- Quản lý danh mục: danh sách, thêm, sửa, ngừng sử dụng/mở lại; kiểm tra tên trùng và giữ liên kết sản phẩm.
- Quản lý sản phẩm: danh sách, tìm theo tên/ID, lọc, thêm, sửa, ngừng kinh doanh/mở lại. ID tự sinh; SKU chỉ còn là cột tương thích nội bộ, không nhập trên giao diện.
- Tải/thay/gỡ ảnh JPG/PNG/WebP, giới hạn kích thước và chuẩn hóa WebP; lưu ảnh trên PostgreSQL, phân quyền xem/sửa ảnh.
- Nhân viên tra cứu sản phẩm, ảnh, tồn và giá bán; dữ liệu trả về không chứa giá cơ sở hoặc quy tắc giá.
- Sản phẩm mới có tồn 0; thay đổi tồn qua dịch vụ kho. Đổi giá cơ sở gọi tính lại giá và ghi lịch sử trong cùng transaction.
- Route, service, repository và giao diện thật cho `/users`, `/products`, `/categories`, tích hợp tại `src/app.js`.
- Kiểm thử quản lý, dữ liệu sai/trùng, phân quyền, ảnh, bảo vệ admin cuối cùng, hủy phiên và rollback.

Cần làm tiếp:

- [ ] Phối hợp người 3 chuyển phiên đăng nhập và giới hạn thử sai khỏi RAM, cấu hình HTTPS/cookie Secure và host khi triển khai.
- [ ] Kiểm tra lại luồng tài khoản, sản phẩm và ảnh sau khi các chức năng còn lại tích hợp hoặc cấu hình triển khai thay đổi.

### Người 2 đã làm được gì và còn thiếu gì

Đã có giao diện nhập kho, kiểm kê tăng/giảm có lý do, bán hàng cho nhân viên, lịch sử kho/bán và cảnh báo tồn thấp. Máy chủ kiểm tra quyền, CSRF, số lượng nguyên dương, tồn đủ và giới hạn số nguyên. Lịch sử cá nhân lọc theo người đăng nhập; admin chỉ xem lịch sử bán của nhân viên.

`applyStockChange` khóa sản phẩm, ghi giao dịch với đơn giá gốc, cập nhật tồn và tính lại giá trong cùng transaction. Dịch vụ đã hỗ trợ IN, SALE, RETURN, ADJUST_IN, ADJUST_OUT và DAMAGE; RETURN/DAMAGE chưa có luồng yêu cầu ở giao diện. Một lần bán hiện ghi một sản phẩm; lịch sử tối đa 100 dòng, chưa có lọc thời gian/phân trang.

- [ ] Duyệt và tích hợp nhánh tính năng vào nhánh chính sau khi kiểm thử; không coi code chỉ có trên nhánh tính năng là đã có trên `main`.
- [ ] Kiểm tra khóa và bán đồng thời bằng nhiều kết nối PostgreSQL thật. Kiểm thử PGlite hiện dùng một kết nối, chưa chứng minh hành vi này trên Supabase.
- [ ] Phối hợp người 4 tích hợp duyệt trả hàng/hàng hỏng; giữ một luồng cập nhật tồn và transaction thống nhất.

### Người 3 và người 4 làm tiếp

- **Người 3:** dùng lại hàm tính giá hiện có; làm quản lý quy tắc theo sản phẩm, tính lại giá từ giao diện, lịch sử giá, số liệu tổng quan, báo cáo doanh thu và cấu hình Render. Doanh thu phải tính SALE trừ RETURN, không cộng hàng hỏng/kiểm kê. Chưa có giao diện quản lý doanh thu hoàn chỉnh.
- **Người 4:** làm gửi và theo dõi yêu cầu trả hàng/hàng hỏng, danh sách chờ duyệt, duyệt/từ chối. Nhân viên chỉ xem yêu cầu mình gửi; trả hàng gắn với lần bán của mình. Khi duyệt, khóa yêu cầu PENDING và dùng `applyStockChange` trong cùng transaction; từ chối không đổi tồn. Có bảng và kiểm thử ràng buộc SQL chưa đồng nghĩa luồng ứng dụng này đã hoàn thành.

## 3 Quyền và phạm vi dữ liệu

Bảng gồm quyền đã có và quyền mục tiêu cho các màn hình còn chờ triển khai: `/requests`, `/requests/return`, `/requests/damage`, `/pricing`, `/pricing/history` và `/reports`. Các đường dẫn này hiện chưa xử lý nghiệp vụ thật.

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

Quản lý tài khoản đã chặn admin tự khóa mình và hạ quyền admin cuối cùng. Tiếp tục giữ cơ chế tăng `session_version` khi đổi quyền/trạng thái hoặc mật khẩu để phiên cũ hết hiệu lực.

## 4 Cách ghép chức năng vào ứng dụng

1. Đặt xử lý request trong `src/routes/`, nghiệp vụ trong `src/services/` và truy vấn trong `src/repositories/`. Dùng tham số `$1`, `$2` của `pg` cho dữ liệu người dùng.
2. Đăng ký route tại `src/app.js` theo cả phương thức và đường dẫn. Các route tài khoản, danh mục, sản phẩm, kho và bán hàng đã chạy trước `authRoutes` và `pageRoutes`; route mới cần được ghép tương tự.
3. `src/routes/pages.js` vẫn trả trang chờ cho các mục chưa triển khai. Khi làm chức năng thật, xử lý trước nhánh trang chờ; không để trang chờ che mất chức năng đã viết.
4. Dùng pool đã tạo trong `createApp` và có sẵn trong context, không tạo pool ở từng request. Dùng `src/utils/transaction.js` khi cần transaction.
5. Route thay đổi dữ liệu phải tự kiểm tra đăng nhập, quyền, `session.csrf` và dữ liệu đầu vào. Route mới không tự được bảo vệ CSRF chỉ nhờ nằm trong ứng dụng.
6. Khi trả trang, dùng `send` và truyền đường dẫn hiện tại vào tham số cuối để thanh bên đánh dấu đúng mục. Escape nội dung người dùng trước khi chèn vào HTML.
7. Khai báo menu tại `src/config/navigation.js`; chỉ sửa `src/views/sidebar.js`, `src/views/layout.js` hoặc CSS chung khi cần đổi bố cục dùng chung.

## 5 Thống nhất nghiệp vụ giữa bốn thành viên

Các dịch vụ cần dùng chung và trạng thái hiện tại:

- Người 1 đã có service tài khoản/sản phẩm và repository tài khoản, danh mục, sản phẩm. Sản phẩm mới tồn 0; đổi giá cơ sở đã gọi tính lại giá trong cùng transaction.
- Người 2 đã có `applyStockChange(client, productId, type, quantity, userId, note = null, relatedMovementId = null)` trong `src/services/inventory.js`. Truyền client transaction, không truyền pool. RETURN phải có ID giao dịch SALE gốc; ADJUST_IN, ADJUST_OUT và DAMAGE bắt buộc lý do. Dịch vụ lấy quyền từ database: SALE chỉ staff, các loại còn lại chỉ admin.
- Đã có `recalculatePrice(client, productId, changedBy, reason)` trong `src/services/pricing.js`, nhận cùng client transaction. Tính từ `base_price`, chặn min/max, làm tròn đến đồng và chỉ ghi `price_history` khi giá đổi. Người 3 dùng lại hàm này cho màn hình quản lý giá.
- Người 4 cần thêm luồng duyệt trong `src/services/requests.js`: khóa và kiểm tra PENDING, gọi dịch vụ kho bằng tài khoản admin duyệt, truyền giao dịch bán gốc cho RETURN; cập nhật trạng thái và liên kết giao dịch trong cùng transaction. Người gửi yêu cầu vẫn được lưu riêng trên yêu cầu, không lấy từ dữ liệu người duyệt do trình duyệt gửi.

Mỗi thao tác dùng một client với BEGIN, COMMIT hoặc ROLLBACK và luôn release. Các dịch vụ phối hợp trong một thao tác phải dùng cùng client; không tự COMMIT một phần rồi mới cập nhật phần còn lại. Thống nhất thứ tự khóa giữa các luồng cùng sửa tồn hoặc giá.

SALE lưu đơn giá trước khi trừ tồn; giá tính lại dùng cho lần bán tiếp theo. RETURN dùng giá bán gốc và không được trả vượt số lượng đã bán. Doanh thu là SALE trừ RETURN; DAMAGE và điều chỉnh kiểm kê không tính vào doanh thu. Yêu cầu PENDING hoặc REJECTED không làm đổi tồn, giá hay doanh thu.

Database đã có các ràng buộc và trigger kiểm tra người tạo giao dịch, trả hàng, trạng thái duyệt và lịch sử kho không sửa/xóa. Những kiểm tra này không tự cập nhật `products.stock` hoặc tính giá. Dịch vụ kho đã làm phần cập nhật tồn/giá; luồng yêu cầu còn phải ghép trạng thái duyệt và giao dịch vào cùng transaction.

## 6 Cơ sở dữ liệu và phối hợp thay đổi

- Chạy dự án theo README. `.env` là cấu hình riêng của từng máy; bắt buộc có `DATABASE_URL`. Không tạo lại `data/users.json` hoặc lệnh seed tài khoản local.
- Không đưa chuỗi kết nối thật, mật khẩu database hoặc mật khẩu băm lên Git. Thông tin đăng nhập dùng cho đồ án được ghi trong README theo cấu hình hiện tại, không cần chép thêm vào TEAM.md.
- Không sửa các migration đã áp dụng: `001_inventory_pricing.sql` và `002_product_images.sql`. Thay đổi schema bằng migration mới, đánh số tiếp theo và chạy `npm run db:migrate`; xác minh bằng `npm run db:check`.
- Không xóa `schema_migrations`. Công cụ dùng bảng này và checksum để tránh áp dụng trùng hoặc sửa lại migration cũ.
- Các bảng bật RLS và chặn truy cập trực tiếp của vai trò trình duyệt. Kết nối PostgreSQL của máy chủ vẫn cần kiểm tra quyền và phạm vi dữ liệu tại ứng dụng; RLS hiện không tự phân biệt admin/nhân viên của Kho Việt.
- Kiểm thử và dữ liệu thử dùng PostgreSQL qua PGlite, không ghi giao dịch giả vào Supabase đang dùng chung. Khi cần dữ liệu demo trên Supabase, nhóm thống nhất riêng dữ liệu và người thực hiện.

## 7 Kiểm thử và thứ tự tích hợp

Ngày 31/10/2026, `npm test` đạt **55/55 kiểm thử**. Hiện có các bộ auth, navigation, database, categories, management, product-images và inventory-sales trong `tests/`. Bao phủ HTTP, phân quyền, dữ liệu đầu vào, ảnh, tính giá và rollback; thêm kiểm thử theo phần việc, `npm test` tự chạy các file `*.test.js`. Đã kiểm tra trình duyệt luồng nhập kho → bán hàng → kiểm kê và 7 màn hình kho/bán ở 1440 px và 375 px bằng dữ liệu thử riêng.

| Người phụ trách | Các ca cần kiểm tra khi hoàn thiện |
| --- | --- |
| 1 | ID tự sinh, email/tên danh mục trùng; dữ liệu không hợp lệ; nhân viên không sửa dữ liệu quản trị; ảnh; đổi quyền/khóa làm mất hiệu lực phiên; bảo vệ admin cuối cùng |
| 2 | Tồn không âm; bán vượt tồn; admin không bán được; nhân viên không xem lịch sử người khác; hai giao dịch đồng thời không bán quá số hàng |
| 3 | Giá ở đúng ngưỡng thấp/cao; min/max; quy tắc tắt; không tăng giảm cộng dồn; lịch sử chỉ ghi khi giá đổi; doanh thu trừ hoàn trả |
| 4 | Gửi hoặc từ chối không đổi tồn; chỉ admin duyệt; không duyệt hai lần; trả không vượt số đã bán; hàng hỏng không vượt tồn; lỗi thì rollback toàn bộ |

Sản phẩm/tài khoản, dịch vụ kho/định giá và nhập kho/bán hàng đã được ghép trong bản tính năng hiện tại. Thứ tự tiếp theo: duyệt tích hợp bản này → yêu cầu và duyệt → quản lý giá, báo cáo/tổng quan → hoàn thiện triển khai. Người 3 và 4 có thể làm song song theo dịch vụ dùng chung; kiểm thử nhiều kết nối PostgreSQL thật vẫn còn cần thực hiện.

Mỗi người làm nhánh Git theo tính năng và chạy `npm test` trước khi gộp. Khi cùng sửa `src/app.js`, navigation, CSS hoặc migration, thống nhất người ghép để tránh ghi đè. Trước khi đánh dấu hoàn thành, kiểm tra cả vai trò admin và nhân viên, đường dẫn trực tiếp, POST trái quyền và luồng lỗi; không chỉ kiểm tra menu hiển thị.
