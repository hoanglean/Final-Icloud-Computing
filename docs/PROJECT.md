# Quản lý tồn kho và định giá động với Supabase

Tài liệu thiết kế và triển khai Kho Việt

Cập nhật ngày 24 tháng 10 năm 2026

## 1 Phạm vi và tiến độ

Kho Việt là ứng dụng web phục vụ một cửa hàng và một kho, quản lý sản phẩm, nhập hàng, bán hàng, trả hàng, hàng hỏng và điều chỉnh giá theo lượng tồn. Backend dùng Node.js; PostgreSQL trên Supabase lưu dữ liệu tập trung. Render là đích triển khai dự kiến, chưa phải môi trường đang vận hành.

Hai vai trò được tách theo công việc: nhân viên bán hàng; quản trị viên quản lý dữ liệu, kho và chính sách giá. Admin không tự bán hàng và không có lịch sử bán cá nhân. Admin xem lịch sử bán của nhân viên trong nhóm Quản trị. Đây là quy tắc áp dụng thay cho mô hình admin có toàn bộ quyền nhân viên.

### Kết quả của giai đoạn hiện tại

| Hạng mục | Trạng thái |
| --- | --- |
| Đăng nhập, đăng xuất và đổi mật khẩu | Đã có, dùng mật khẩu băm bằng scrypt |
| Phân quyền và thanh chức năng bên trái | Đã có; kiểm tra quyền ở cả menu và máy chủ |
| Kết nối PostgreSQL trên Supabase | Đã cấu hình bằng pg, có xác minh chứng chỉ TLS |
| Bảy bảng nghiệp vụ và migration | Đã tạo; có ràng buộc dữ liệu và RLS |
| Lưu và đổi mật khẩu trong PostgreSQL | Hai tài khoản ban đầu đã chuyển lên Supabase; đã bỏ cơ chế tài khoản JSON |
| Phiên đăng nhập và giới hạn thử mật khẩu | Đang lưu RAM, mất khi khởi động lại |
| Màn hình sản phẩm, kho, bán hàng và báo cáo | Mới có điều hướng và trang đang phát triển |
| Giao dịch kho, duyệt yêu cầu và tính giá | Đã thiết kế luồng; dịch vụ nghiệp vụ chưa triển khai |
| Triển khai công khai trên Render | Chưa thực hiện |

---

## 2 Phân quyền và tổ chức chức năng

| Chức năng | Admin | Nhân viên |
| --- | --- | --- |
| Đăng nhập, đăng xuất, đổi mật khẩu của mình | Có | Có |
| Tra cứu sản phẩm, giá bán, tồn và cảnh báo | Có | Có |
| Xem giá cơ sở và quy tắc định giá | Có | Không |
| Bán hàng | Không | Có |
| Xem lịch sử bán của chính mình | Không | Có |
| Xem lịch sử bán của nhân viên | Có | Không |
| Nhập kho và điều chỉnh kiểm kê | Có | Không |
| Quản lý sản phẩm và danh mục | Có | Không |
| Gửi yêu cầu trả hàng hoặc hàng hỏng | Có | Có |
| Duyệt hoặc từ chối yêu cầu | Có | Không |
| Xem toàn bộ lịch sử kho và giá | Có | Không |
| Cấu hình giá và xem báo cáo | Có | Không |
| Tạo, đổi vai trò và khóa tài khoản | Có | Không |

Nhân viên chỉ xem giao dịch do chính tài khoản đó tạo và yêu cầu do mình gửi. Khi đề xuất trả hàng, nhân viên chọn giao dịch bán gốc của mình. Admin có thể gửi yêu cầu xử lý cho giao dịch của nhân viên; quyền này không cho phép admin tạo giao dịch SALE.

### Thanh chức năng bên trái

Nhân viên thấy Trang chủ, Sản phẩm, Cảnh báo tồn thấp, Bán hàng, Lịch sử bán của tôi, Yêu cầu trả hàng, Báo hàng hỏng và Yêu cầu của tôi.

Admin thấy Tổng quan; Sản phẩm và Danh mục; Nhập kho, Kiểm kê, Lịch sử kho và Cảnh báo tồn thấp; các mục trả hàng và hàng hỏng. Nhóm Quản trị chứa Lịch sử bán hàng nhân viên, Quy tắc định giá, Lịch sử giá, Báo cáo và Quản lý tài khoản. Admin không thấy nhóm Bán hàng.

### Kiểm tra quyền khi lập trình

Vai trò phải lấy từ tài khoản phía máy chủ, không lấy từ dữ liệu form. Route bán hàng phải kiểm tra chính xác role bằng staff. Không dùng hasRole(user, 'staff') cho thao tác này vì helper hiện tại cho phép cả admin. Không cho admin tự khóa mình hoặc hạ quyền admin cuối cùng khi triển khai quản lý tài khoản.

---

## 3 Công nghệ và kết nối cơ sở dữ liệu

Ứng dụng hiện dùng module HTTP có sẵn của Node.js và các hàm JavaScript tạo HTML. CSS nằm trong public. Không dùng Express, EJS hoặc Bootstrap ở giai đoạn hiện tại; không cần chuyển framework chỉ để kết nối Supabase.

Luồng truy cập là trình duyệt → máy chủ Node.js → repository hoặc dịch vụ nghiệp vụ → PostgreSQL trên Supabase. Trình duyệt không nhận mật khẩu database, khóa quản trị hay truy cập trực tiếp bảng users. Cơ chế đăng nhập hiện có được giữ lại; chưa chuyển sang Supabase Auth.

### Cấu hình

File .env chứa PORT, SUPABASE_PROJECT_REF, DATABASE_URL và DATABASE_SSL_CA_FILE. Dự án Supabase sử dụng mã gbkchphcndmaoaopuqpv. DATABASE_URL lấy từ Connect, chế độ Session pooler; ký tự đặc biệt trong mật khẩu phải được mã hóa trong URL. Không ghi mật khẩu hoặc chuỗi kết nối thật vào tài liệu và Git.

Ứng dụng tự đọc .env khi khởi động. DATABASE_URL là bắt buộc; tài khoản chỉ được lưu và truy vấn trên PostgreSQL của Supabase. Thiếu cấu hình hoặc mất kết nối thì báo lỗi, không chuyển sang JSON hoặc tự sinh tài khoản mặc định. Hai tài khoản ban đầu đã được chuyển lên Supabase và giữ nguyên mật khẩu. Kiểm thử dùng PostgreSQL qua PGlite với dữ liệu riêng, không tác động dữ liệu thật.

### Chạy và kiểm tra

- npm install: cài thư viện theo package-lock.json.
- npm run db:migrate: áp dụng migration trong transaction, ghi phiên bản và checksum.
- npm run db:check: xác minh kết nối, danh sách bảng, RLS và số tài khoản theo vai trò.
- npm start: khởi động ứng dụng; npm run dev bật tự tải lại mã nguồn.
- npm test: chạy kiểm thử đăng nhập, phân quyền và ràng buộc PostgreSQL.

Migration không xóa bảng hoặc dữ liệu hiện có. Không sửa file migration đã áp dụng; thay đổi cấu trúc về sau phải thêm migration mới. Công cụ chuyển tài khoản một lần và file tài khoản JSON đã được loại bỏ sau khi chuyển và đối chiếu dữ liệu. Trang đăng nhập không hiển thị tài khoản dùng thử hoặc mật khẩu mặc định.

### Bảo vệ kết nối

Kết nối bật TLS và xác minh chứng chỉ. File database/certs/supabase-ca.crt là chứng chỉ CA công khai của Supabase. Không tắt xác minh chứng chỉ để xử lý lỗi kết nối. Trong các schema được công khai qua API, bảng đã bật RLS và thu hồi quyền của anon và authenticated. Máy chủ dùng kết nối PostgreSQL riêng, nên vẫn phải kiểm tra vai trò và phạm vi bản ghi ở từng route.

---

## 4 Thiết kế bảng và quan hệ

| Bảng | Các cột chính |
| --- | --- |
| users | id, name, email, password_hash, role, is_active, session_version, created_at |
| categories | id, name, is_active, created_at |
| products | id, sku, name, category_id, base_price, current_price, stock, is_active, created_at |
| stock_movements | id, product_id, type, quantity, unit_price, user_id, note, related_movement_id, created_at |
| stock_requests | id, type, product_id, quantity, reason, related_movement_id, requested_by, status, reviewed_by, reviewed_at, review_note, movement_id, created_at |
| pricing_rules | id, product_id, low_stock, high_stock, increase_percent, discount_percent, min_price, max_price, enabled, created_at |
| price_history | id, product_id, old_price, new_price, reason, changed_by, created_at |

Ngoài bảy bảng nghiệp vụ, schema_migrations lưu tên migration, checksum và thời điểm áp dụng. Đây là bảng kỹ thuật, không phải dữ liệu kinh doanh.

### Quan hệ cần thể hiện trong ERD

- categories có nhiều products; mỗi sản phẩm thuộc một danh mục.
- products có nhiều stock_movements, stock_requests và price_history.
- Mỗi product có tối đa một pricing_rules; product_id được đặt UNIQUE.
- users liên kết với stock_movements qua user_id và price_history qua changed_by.
- stock_requests liên kết users qua requested_by và reviewed_by.
- stock_movements tự tham chiếu qua related_movement_id: RETURN trỏ về SALE gốc.
- stock_requests.movement_id trỏ đến giao dịch được tạo khi yêu cầu được duyệt.

Khóa chính dùng số nguyên identity. Các mốc thời gian dùng timestamptz; thời gian hiển thị cho người dùng theo Asia/Saigon. Tiền dùng NUMERIC(14,2); quy tắc tính giá VND làm tròn đến đồng tại dịch vụ nghiệp vụ. Các khóa ngoại giữ lịch sử bằng ON DELETE RESTRICT.

Đã có chỉ mục cho danh mục sản phẩm, giao dịch theo sản phẩm và người bán, giao dịch gốc, yêu cầu theo trạng thái và người gửi, người duyệt và lịch sử giá. Các chỉ mục phục vụ tra cứu thực tế; không thay thế kiểm tra quyền truy cập.

---

## 5 Ràng buộc và tính toàn vẹn dữ liệu

Email là duy nhất, lưu chữ thường và không có khoảng trắng ở hai đầu. SKU là duy nhất, lưu chữ hoa và không có khoảng trắng ở hai đầu. Tên danh mục không được trùng nếu chỉ khác chữ hoa thường. Tồn kho là số nguyên không âm; số lượng giao dịch và yêu cầu phải lớn hơn 0. Giá phải hữu hạn và không âm.

Ngưỡng tồn thấp phải không âm và nhỏ hơn ngưỡng tồn cao. Phần trăm tăng giá không âm; phần trăm giảm nằm trong khoảng 0 đến 100. Giá tối thiểu không vượt giá tối đa. Không ghi price_history nếu giá cũ bằng giá mới.

### Giao dịch kho

IN, RETURN và ADJUST_IN tăng tồn; SALE, ADJUST_OUT và DAMAGE giảm tồn. Số lượng luôn dương, chiều thay đổi nằm trong type. ADJUST_IN, ADJUST_OUT và DAMAGE bắt buộc có ghi chú. RETURN bắt buộc trỏ đến SALE gốc, cùng sản phẩm và cùng đơn giá; tổng số đã trả không được vượt số đã bán.

Database chỉ cho nhân viên đang hoạt động tạo SALE. Các giao dịch kho khác yêu cầu admin đang hoạt động. Kiểm tra này dùng tài khoản trong user_id; máy chủ phải tự gán user_id từ phiên đăng nhập, không tin user_id do trình duyệt gửi lên. Lịch sử kho không cho sửa hoặc xóa; thay đổi nghiệp vụ phải tạo giao dịch bù trừ.

### Yêu cầu xử lý hàng

Yêu cầu mới phải ở PENDING. Chỉ admin đang hoạt động được đổi sang APPROVED hoặc REJECTED và chỉ quyết định một lần. Khi duyệt, không sửa sản phẩm, số lượng, người gửi hoặc lý do của yêu cầu gốc. APPROVED bắt buộc có giao dịch kết quả khớp loại, sản phẩm, số lượng, người duyệt và giao dịch bán gốc. REJECTED không có giao dịch kết quả.

### Phần phải hoàn thiện trong dịch vụ

Ràng buộc database không tự cập nhật tồn hoặc tính giá. Các thao tác cần dịch vụ dùng chung applyStockChange để khóa sản phẩm, kiểm tra trạng thái, chống bán vượt tồn, ghi lịch sử, cập nhật stock và tính lại giá trong cùng transaction. Thay đổi giá cơ sở, quy tắc và duyệt yêu cầu phải khóa cùng dòng sản phẩm để tránh ghi đè.

Sản phẩm đã có giao dịch được ngừng kinh doanh thay vì xóa lịch sử. Quản lý tài khoản cần bảo vệ admin cuối cùng và tăng session_version khi đổi mật khẩu, đổi quyền hoặc khóa tài khoản. Đổi mật khẩu hiện đã tăng session_version bằng một câu UPDATE có kiểm tra mật khẩu băm cũ để chống ghi đè đồng thời.

---

## 6 Định giá và xử lý giao dịch kho

Giá luôn được tính từ base_price, không từ current_price. Đây là quy tắc kinh doanh theo tồn kho để thử nghiệm, chưa phải thuật toán dự báo nhu cầu hoặc bằng chứng rằng tăng giá khi ít hàng luôn làm tăng doanh thu.

| Điều kiện minh họa | Công thức | Giá cơ sở 100000 đồng |
| --- | --- | --- |
| Tồn kho không quá 10 | base_price × 1,10 | 110000 đồng |
| Tồn kho từ 100 trở lên | base_price × 0,90 | 90000 đồng |
| Tồn kho ở giữa hai ngưỡng | base_price | 100000 đồng |

Sau khi tính, giới hạn kết quả từ min_price đến max_price và làm tròn đến đồng. Chưa có quy tắc hoặc đã tắt quy tắc thì dùng giá cơ sở. Các con số trên là ví dụ, không phải dữ liệu sản phẩm đã được thêm vào database.

### Thời điểm tính lại giá

Tính lại sau mỗi thay đổi tồn thành công: nhập kho, bán, duyệt trả hàng, duyệt hàng hỏng và kiểm kê. Tính lại khi admin sửa giá cơ sở, sửa quy tắc hoặc chủ động yêu cầu. Chỉ ghi price_history nếu kết quả khác giá hiện tại; changed_by có thể trống nếu hệ thống tự điều chỉnh.

### Luồng bán hàng dành cho nhân viên

1. Máy chủ xác nhận tài khoản đang hoạt động và role là staff.
2. Mở transaction trên một client lấy từ connection pool.
3. Khóa dòng sản phẩm bằng SELECT FOR UPDATE, kiểm tra sản phẩm còn kinh doanh và tồn đủ.
4. Ghi SALE với đơn giá current_price trước khi cập nhật, user_id lấy từ phiên.
5. Trừ tồn, tính lại giá cho lần bán sau và ghi lịch sử nếu giá đổi.
6. Commit toàn bộ hoặc rollback toàn bộ; luôn trả client về pool.

Ví dụ còn 11 chiếc, giá 100000 đồng; nhân viên bán 2 chiếc thì giao dịch có giá trị 200000 đồng. Tồn còn 9 và giá 110000 đồng chỉ áp dụng cho lần bán tiếp theo. Hai người cùng mua không được làm tồn âm.

### Lịch sử bán hàng và doanh thu

Nhân viên chỉ xem SALE do mình tạo. Admin xem SALE của nhân viên tại /admin/sales-history, có thể bổ sung lọc theo người bán và thời gian. Doanh thu bằng tổng quantity × unit_price của SALE trừ tổng tương ứng của RETURN. Không dùng giá hiện tại để tính lại giao dịch cũ; DAMAGE và ADJUST không tạo doanh thu bán hàng.

---

## 7 Trả hàng và hàng hỏng có duyệt

Yêu cầu và giao dịch kho là hai đối tượng riêng. Khi gửi yêu cầu, hệ thống chỉ tạo stock_requests ở PENDING, chưa đổi tồn, giá hoặc doanh thu. Nhân viên chỉ thấy yêu cầu của mình; admin thấy toàn bộ danh sách chờ duyệt.

### Trả hàng

Nhân viên chọn SALE của mình, nhập số lượng và lý do. Hệ thống kiểm tra sản phẩm, số lượng đã bán và số đã trả trước khi tạo yêu cầu. Admin có thể gửi yêu cầu cho giao dịch của nhân viên khi cần xử lý tại cửa hàng.

Khi duyệt, dịch vụ khóa dòng yêu cầu và sản phẩm trong một transaction, kiểm tra lại PENDING và lượng được trả. Sau đó gọi applyStockChange tạo RETURN, tăng tồn, dùng đơn giá bán gốc, tính lại giá và cập nhật reviewed_by, reviewed_at, movement_id cùng trạng thái APPROVED. Mọi lỗi phải rollback để không tồn tại giao dịch hoặc trạng thái duyệt dở dang.

Hai yêu cầu cùng trỏ về một SALE phải được kiểm tra lại khi duyệt; không thể dựa vào kết quả kiểm tra lúc gửi. Database khóa SALE gốc khi ghi RETURN và kiểm tra tổng số đã trả để chống hoàn vượt số bán.

### Hàng hỏng

Người gửi chọn sản phẩm, số lượng và lý do. Khi duyệt, admin tạo DAMAGE, trừ tồn và tính lại giá trong cùng transaction; số lượng không vượt tồn hiện có. DAMAGE không cần giao dịch bán gốc, không ghi doanh thu và bắt buộc có ghi chú.

### Từ chối và kiểm kê

Từ chối chỉ đổi trạng thái sang REJECTED và ghi người duyệt, thời điểm, ghi chú xem xét; không tạo stock_movements. Yêu cầu đã quyết định không được duyệt lại. Admin ghi kiểm kê trực tiếp bằng ADJUST_IN hoặc ADJUST_OUT, bắt buộc có ghi chú và đi qua cùng dịch vụ thay đổi tồn kho.

### Lưu ý về đồng thời

Mọi thao tác cùng sửa tồn hoặc giá phải thống nhất thứ tự khóa, giữ transaction ngắn và không gọi dịch vụ bên ngoài trong lúc khóa sản phẩm. Request HTTP không được tự gán người bán, người duyệt, giá giao dịch hoặc trạng thái cuối từ dữ liệu form chưa kiểm tra.

---

## 8 Kiểm thử và lộ trình triển khai

Kiểm thử hiện có bao gồm luồng đăng nhập qua repository PostgreSQL, CSRF, phân quyền, đổi mật khẩu, hủy phiên, giới hạn thử sai; menu theo vai trò; quyền truy cập trực tiếp; ràng buộc SQL; quyền người tạo SALE; trả hàng đúng giá và không vượt số bán; duyệt yêu cầu một lần; đổi mật khẩu có kiểm tra phiên bản; bảo vệ bảng bằng RLS. Kiểm thử dùng PostgreSQL qua PGlite với tài khoản riêng, không ghi dữ liệu demo vào database thật và không dùng tài khoản JSON.

### Các ca cần bổ sung khi xây dựng nghiệp vụ

- Bán đúng lượng tồn, bán vượt tồn, sản phẩm ngừng kinh doanh và hai giao dịch đồng thời.
- Bán qua ngưỡng giá, nhập hàng qua ngưỡng giảm, chặn giá theo min và max.
- Gửi yêu cầu không đổi tồn; từ chối không đổi tồn; duyệt hoàn trả theo giá bán gốc.
- Duyệt hai lần hoặc hai yêu cầu trả vượt lượng bán phải thất bại và không để dữ liệu dở dang.
- Nhân viên không xem được lịch sử người khác, giá cơ sở hoặc quy tắc định giá.
- Admin không tạo được SALE, kể cả khi nhập trực tiếp đường dẫn hoặc tự gửi POST.
- Doanh thu trừ RETURN; DAMAGE và kiểm kê không làm thay đổi doanh thu bán hàng.

### Thứ tự phát triển tiếp

1. Hoàn thiện sản phẩm, danh mục và quản lý tài khoản, dùng dữ liệu Supabase.
2. Làm applyStockChange, nhập kho, bán hàng và lịch sử kho trong transaction.
3. Làm dịch vụ định giá, cấu hình quy tắc và lịch sử giá.
4. Làm yêu cầu, duyệt trả hàng, hàng hỏng và điều chỉnh kiểm kê.
5. Làm lịch sử bán nhân viên cho admin, lọc dữ liệu và báo cáo.
6. Hoàn thiện kiểm thử, phiên bền vững và cấu hình Render.

### Trước khi triển khai công khai

Máy chủ hiện chỉ nghe địa chỉ loopback; khi triển khai cần cấu hình HOST phù hợp môi trường. Bổ sung HTTPS, cookie Secure, session store bền vững và giới hạn đăng nhập dùng chung nếu chạy nhiều tiến trình. Quản lý bí mật bằng biến môi trường của nền tảng. Không ghi mật khẩu thật trong mã nguồn hoặc tài liệu. Kiểm tra khôi phục dữ liệu và quyền truy cập trước khi đưa cửa hàng vào sử dụng.

### Tài liệu kỹ thuật tham chiếu

- Supabase Connecting to Postgres: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Mã nguồn migration: database/migrations/001_inventory_pricing.sql
- Hướng dẫn chạy dự án: README.md
