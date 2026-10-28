# Kho Việt — Quản lý kho và định giá động

Ứng dụng quản lý cửa hàng dùng Node.js 22 trở lên, giao diện HTML/CSS và PostgreSQL trên Supabase. Đã hoàn thiện các chức năng chính của nhiệm vụ 1: quản lý tài khoản, danh mục, sản phẩm và ảnh sản phẩm, cùng nền tảng đăng nhập và phân quyền.

Thông tin bên dưới phản ánh mã nguồn đang phát triển tại ngày **28/10/2026**. Chức năng kho, bán hàng, yêu cầu xử lý hàng và báo cáo vẫn cần hoàn thiện.

## Chức năng và tiến độ

| Phần | Trạng thái hiện tại |
| --- | --- |
| Đăng nhập, đăng xuất, đổi mật khẩu | Đã có; mật khẩu băm, kiểm tra CSRF, giới hạn thử sai và hủy phiên cũ |
| Quản lý tài khoản | Danh sách, tạo, đổi vai trò, khóa/mở khóa; không cho tự khóa hoặc loại bỏ admin hoạt động cuối cùng |
| Danh mục | Danh sách, thêm, sửa tên, ngừng sử dụng/mở lại; kiểm tra tên trùng và giữ liên kết sản phẩm |
| Sản phẩm | Danh sách, tìm theo tên/ID, lọc danh mục/trạng thái, thêm, sửa, ngừng kinh doanh/mở lại |
| ID sản phẩm | ID số tự sinh; không nhập hoặc sửa thủ công, không yêu cầu nhập SKU |
| Ảnh sản phẩm | Tải, thay, gỡ ảnh khi thêm/sửa; hiển thị ảnh trong danh sách cho cả hai vai trò |
| Tra cứu cho nhân viên | Xem ảnh, giá bán, tồn và trạng thái; không nhận giá cơ sở hoặc quy tắc định giá |
| Tính lại giá | Có hàm dùng chung; đổi giá cơ sở sẽ tính lại giá bán và ghi lịch sử trong cùng transaction |
| Nhập kho, kiểm kê, cảnh báo tồn và lịch sử kho | Mới có menu, phân quyền và trang đang phát triển |
| Bán hàng và lịch sử bán | Mới có menu, phân quyền và trang đang phát triển; admin không bán hàng |
| Trả hàng, hàng hỏng và duyệt yêu cầu | Mới có menu, phân quyền và trang đang phát triển |
| Màn hình quy tắc giá, lịch sử giá và báo cáo doanh thu | Chưa có xử lý nghiệp vụ hoàn chỉnh trên giao diện |
| Triển khai Render | Chưa triển khai công khai |

Giao diện có thanh chức năng theo vai trò và bố cục thích ứng cho máy tính, máy tính bảng, điện thoại. Trang tổng quan hiện chưa có thống kê doanh thu hoặc tồn kho.

## Chạy ứng dụng

Cần Node.js 22 trở lên. Ứng dụng tự đọc `.env`: sao chép `.env.example` cho máy mới, rồi điền chuỗi PostgreSQL từ Supabase → Connect → Session pooler vào `DATABASE_URL`. Mã hóa các ký tự đặc biệt trong mật khẩu bằng URL encoding. Không đưa `.env` lên Git hoặc gửi chuỗi kết nối trong tài liệu.

- `DATABASE_URL` là bắt buộc: đăng nhập và đổi mật khẩu chỉ dùng bảng `public.users` trên Supabase. Thiếu cấu hình hoặc kết nối lỗi thì ứng dụng báo lỗi, không tạo hay dùng tài khoản JSON thay thế.
- `DATABASE_SSL_CA_FILE` trỏ tới chứng chỉ CA công khai `database/certs/supabase-ca.crt`. Kết nối luôn xác minh chứng chỉ TLS.
- `SUPABASE_PROJECT_REF` dùng để kiểm tra chuỗi kết nối trỏ đúng dự án. Dự án hiện tại là `gbkchphcndmaoaopuqpv`.

Sau khi cấu hình `.env`, chạy:

```sh
npm ci
npm run db:migrate
npm start
```

Mở http://localhost:3000. Dùng `npm run dev` thay `npm start` nếu muốn tự khởi động lại khi sửa mã. Sau khi lấy phiên bản mới từ Git, chạy lại `npm ci` và `npm run db:migrate` trước khi mở ứng dụng.

Không có `start.bat` trong dự án. Server hiện chỉ lắng nghe loopback và chưa được triển khai lên Render.

## Cơ sở dữ liệu

```sh
npm run db:migrate
npm run db:check
```

`db:migrate` chạy các file SQL theo thứ tự trong một transaction, khóa chống chạy đồng thời và lưu checksum trong `schema_migrations`. Chạy lại không tạo lại bảng. Thay đổi schema phải thêm migration mới, không sửa migration đã áp dụng.

Hai tài khoản ban đầu đã được chuyển lên Supabase. Cơ chế tạo tài khoản JSON và lệnh chuyển tài khoản một lần đã được loại bỏ. Có bộ dữ liệu mẫu gồm 20 sản phẩm và 4 danh mục; không tạo giao dịch bán hoặc nhập kho giả.

Các migration hiện có:

- `001_inventory_pricing.sql`: tạo 7 bảng nghiệp vụ, khóa ngoại, ràng buộc, trigger và RLS.
- `002_product_images.sql`: thêm `products.image_data` để lưu ảnh và giới hạn dữ liệu ảnh tối đa 2 MB; giữ nguyên sản phẩm hiện có.

Bảy bảng nghiệp vụ: `users`, `categories`, `products`, `stock_movements`, `stock_requests`, `pricing_rules`, `price_history`. `schema_migrations` là bảng kỹ thuật. Tất cả bật RLS; vai trò trình duyệt `anon` và `authenticated` không có quyền đọc hoặc ghi trực tiếp. Node.js dùng kết nối PostgreSQL riêng và kiểm tra quyền tại máy chủ; không dùng Supabase Auth ở bản hiện tại.

Ràng buộc SQL kiểm tra tồn không âm, số lượng dương, giá hữu hạn, khóa ngoại, ngưỡng định giá, SALE chỉ do nhân viên tạo, trả đúng giá gốc và không vượt số đã bán, duyệt yêu cầu chỉ một lần bởi admin. Các ràng buộc này không tự cập nhật tồn hoặc giá. Dịch vụ giao dịch kho và bán hàng chưa triển khai; riêng đổi giá cơ sở đã gọi dịch vụ tính giá trong cùng transaction.

## Sản phẩm và dữ liệu mẫu

- Sản phẩm mới có tồn ban đầu bằng 0. Form sản phẩm không cho sửa tồn trực tiếp; tồn đầu kỳ và thay đổi số lượng phải đi qua nghiệp vụ kho khi phần này hoàn thiện.
- Giao diện hiển thị và tìm kiếm theo **ID sản phẩm**. Cột SKU cũ vẫn giữ trong database để tương thích dữ liệu đã có; ứng dụng tự gán giá trị nội bộ cho sản phẩm mới và không yêu cầu người dùng nhập SKU.
- Khi đổi giá cơ sở, `src/services/pricing.js` tính từ giá cơ sở theo quy tắc đang bật, giới hạn min/max và làm tròn đến đồng. Chưa có hoặc đã tắt quy tắc thì dùng giá cơ sở. Chỉ ghi `price_history` khi giá bán đổi; lỗi thì hoàn tác cả lần lưu sản phẩm.
- Tên sản phẩm, danh mục, giá và các thao tác quản lý chỉ được thay đổi bởi admin. Không xóa cứng sản phẩm hoặc danh mục qua giao diện; dùng ngừng kinh doanh/ngừng sử dụng để giữ liên kết dữ liệu.

File `database/seeds/001_demo_catalog.sql` chứa bộ dữ liệu minh họa đã thêm lên Supabase:

| Danh mục | Số sản phẩm |
| --- | --- |
| Đồ uống | 5 |
| Bánh kẹo | 5 |
| Thực phẩm thiết yếu | 5 |
| Chăm sóc cá nhân | 5 |

Giá trong bộ mẫu dùng cho đồ án, không phải báo giá thị trường. Tồn khi tạo bằng 0 và chưa gắn ảnh. File seed chạy riêng sau migration, không được tự chạy bởi `db:migrate`; có thể thực thi bằng SQL Editor của Supabase. Chạy lại không ghi đè giá, tồn hoặc sản phẩm đã có cùng SKU nội bộ.

## Ảnh sản phẩm

Admin vào **Sản phẩm → Thêm sản phẩm/Sửa sản phẩm → Ảnh sản phẩm**, chọn tệp rồi lưu. Để trống tệp khi sửa sẽ giữ ảnh hiện tại; chọn **Gỡ ảnh hiện tại** để xóa ảnh. Không chọn thay và gỡ ảnh cùng lúc.

- Chấp nhận ảnh JPG, PNG, WebP tối đa 2 MB, tối đa 16 triệu điểm ảnh đầu vào.
- Máy chủ dùng `sharp` giải mã, xoay ảnh theo hướng gốc, thu nhỏ tối đa 1200 × 1200, bỏ metadata và chuyển sang WebP trước khi lưu.
- Ảnh nằm trong cột `image_data` của PostgreSQL trên Supabase, không nằm trong thư mục ảnh local hoặc Supabase Storage bucket.
- Cả admin và nhân viên đã đăng nhập xem ảnh qua `/products/:id/image`; chỉ admin được tải, thay hoặc gỡ ảnh. Danh sách chỉ đọc thông tin có ảnh, không tải toàn bộ dữ liệu ảnh trong truy vấn sản phẩm.
- Sản phẩm chưa có ảnh vẫn sử dụng bình thường. Nếu lưu thất bại, tệp tải lên cần được chọn lại trước khi gửi biểu mẫu.

## Phân quyền

- Nhân viên: hiện đã tra cứu được sản phẩm, giá bán, tồn, trạng thái và ảnh. Bán hàng, lịch sử bán cá nhân, cảnh báo tồn và yêu cầu là phạm vi quyền dự kiến, còn chờ triển khai nghiệp vụ.
- Admin: hiện đã quản lý được sản phẩm, ảnh, danh mục và tài khoản. Nhập kho, kiểm kê, duyệt yêu cầu, màn hình định giá và báo cáo còn chờ triển khai.
- Admin không được tự bán hàng hoặc vào lịch sử bán cá nhân. Route `/sales` và `/sales/history` chặn admin; `/admin/sales-history` chỉ dành cho admin.
- Trang lịch sử bán nhân viên trong nhóm Quản trị mới có điều hướng và kiểm tra quyền; chưa có màn hình truy vấn giao dịch thật.

Nhân viên vào `/admin` nhận 403. Trang chủ admin ở `/admin`, nhân viên ở `/staff`. Thao tác thay đổi dữ liệu dùng POST và kiểm tra CSRF.

## Tài khoản trên Supabase

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Admin | admin@khoviet.local | KhoViet@123 |
| Nhân viên | staff@khoviet.local | KhoViet@123 |

Đây là thông tin tài khoản ban đầu của đồ án; nếu đã đổi mật khẩu, dùng mật khẩu mới. Email có đuôi `.local` nhưng tài khoản được lưu trên Supabase. Không công khai mật khẩu trên trang đăng nhập; hệ thống không tự sinh tài khoản mặc định.

Mật khẩu băm bằng scrypt. Đổi mật khẩu tăng `session_version` bằng cập nhật có điều kiện để chống ghi đè đồng thời và hủy phiên cũ. Đổi vai trò hoặc khóa/mở khóa cũng tăng phiên bản để phiên cũ không dùng lại được. Vai trò, trạng thái hoạt động và phiên bản tài khoản được đọc lại từ database ở mỗi request.

## Cấu trúc thư mục

```text
Final-Icloud/
├── src/                                  # Mã nguồn ứng dụng Node.js
│   ├── server.js                         # Đọc cấu hình và khởi chạy máy chủ
│   ├── app.js                            # Ghép kết nối, xác thực và xử lý request
│   ├── db.js                             # Connection pool PostgreSQL trên Supabase
│   ├── config/
│   │   ├── env.js                        # Nạp biến môi trường từ .env
│   │   ├── roles.js                      # Trang chủ tương ứng từng vai trò
│   │   └── navigation.js                 # Danh sách chức năng và quyền trên menu
│   ├── routes/
│   │   ├── auth.js                       # Đăng nhập, đăng xuất, đổi mật khẩu
│   │   ├── pages.js                      # Trang chủ, kiểm tra quyền, trang chờ nghiệp vụ
│   │   ├── categories.js                 # Thêm, sửa, ngừng sử dụng danh mục
│   │   ├── products.js                   # Tra cứu, quản lý sản phẩm và trả ảnh
│   │   └── users.js                      # Tạo tài khoản, đổi vai trò và trạng thái
│   ├── middleware/
│   │   ├── auth.js                       # Xác thực phiên và kiểm tra vai trò
│   │   └── security.js                   # Các header bảo mật
│   ├── services/
│   │   ├── password.js                   # Băm và kiểm tra mật khẩu bằng scrypt
│   │   ├── session.js                    # Tạo, hủy phiên đăng nhập lưu trong RAM
│   │   ├── users.js                      # Quy tắc tài khoản và bảo vệ admin cuối cùng
│   │   ├── products.js                   # Lưu sản phẩm, trạng thái, ảnh và tính giá
│   │   ├── product-images.js             # Xác thực, thu nhỏ và chuẩn hóa ảnh WebP
│   │   └── pricing.js                    # Tính lại giá, ghi lịch sử bằng client transaction
│   ├── repositories/
│   │   ├── users-postgres.js             # Truy vấn tài khoản và phiên bản đăng nhập
│   │   ├── categories.js                 # Truy vấn danh mục
│   │   └── products.js                   # Truy vấn sản phẩm và dữ liệu ảnh
│   ├── utils/
│   │   ├── html.js                       # Escape nội dung trước khi đưa vào HTML
│   │   ├── http.js                       # Đọc form, chuyển hướng và trả trang HTML
│   │   ├── product-form.js               # Đọc multipart và giới hạn dung lượng tải lên
│   │   ├── validation.js                 # Kiểm tra ID, tên, giá và trạng thái
│   │   └── transaction.js                # BEGIN, COMMIT/ROLLBACK và giải phóng client
│   └── views/
│       ├── layout.js                     # Bố cục chung, thanh trên và vùng nội dung
│       ├── sidebar.js                    # Thanh chức năng bên trái theo vai trò
│       ├── auth/
│       │   ├── login.js                  # Giao diện đăng nhập
│       │   └── change-password.js        # Giao diện đổi mật khẩu
│       ├── dashboard/
│       │   └── home.js                   # Trang chủ admin và nhân viên
│       ├── categories/index.js           # Danh sách và biểu mẫu danh mục
│       ├── products/index.js             # Danh sách, bộ lọc, biểu mẫu sản phẩm và ảnh
│       └── users/index.js                # Danh sách và biểu mẫu tài khoản
├── public/                               # Tệp giao diện tĩnh
│   ├── css/
│   │   ├── tokens.css                    # Màu, font, kích thước và khoảng cách dùng chung
│   │   ├── base.css                      # Nền tảng hiển thị và focus bàn phím
│   │   └── style.css                     # Bố cục thích ứng và giao diện chức năng
│   ├── js/                               # Chưa có mã JavaScript phía trình duyệt
│   └── images/                           # Chưa có tệp ảnh
├── database/                             # Thiết lập database; dữ liệu thật ở Supabase
│   ├── certs/
│   │   ├── supabase-ca.crt                # Chứng chỉ CA công khai để xác minh TLS
│   │   └── README.md                      # Nguồn và hướng dẫn chứng chỉ
│   ├── migrations/
│   │   ├── 001_inventory_pricing.sql      # Tạo 7 bảng nghiệp vụ, ràng buộc và RLS
│   │   └── 002_product_images.sql         # Thêm cột ảnh và giới hạn dung lượng
│   └── seeds/
│       └── 001_demo_catalog.sql           # 4 danh mục, 20 sản phẩm minh họa
├── scripts/
│   ├── db-migrate.js                      # Chạy và theo dõi phiên bản migration
│   └── db-check.js                        # Kiểm tra kết nối, bảng và số tài khoản
├── tests/
│   ├── auth.test.js                       # Đăng nhập, đổi mật khẩu và yêu cầu database
│   ├── navigation.test.js                 # Menu và quyền truy cập theo vai trò
│   ├── database.test.js                   # Ràng buộc PostgreSQL và repository tài khoản
│   ├── categories.test.js                 # Quản lý danh mục qua HTTP và PostgreSQL
│   ├── management.test.js                 # Tài khoản, sản phẩm, phân quyền và tính giá
│   ├── product-images.test.js             # Tải ảnh, phân quyền, giới hạn và hoàn tác
│   └── helpers/schema.js                  # Áp dụng đầy đủ migration cho database thử
├── docs/
│   ├── TEAM.md                           # Phân công và hướng dẫn phối hợp 4 thành viên
│   ├── PROJECT.md                        # Thiết kế dự án
│   └── Inventory_Dynamic_Pricing_Supabase.docx  # Tài liệu Word
├── node_modules/                         # Thư viện do npm cài, không đưa lên Git
├── .env                                  # Kết nối riêng của máy, không đưa lên Git
├── .env.example                          # Mẫu cấu hình không chứa mật khẩu database
├── .gitignore                            # Loại trừ cấu hình riêng và thư viện khỏi Git
├── package.json                          # Thư viện, yêu cầu Node.js và lệnh chạy
├── package-lock.json                     # Khóa phiên bản thư viện
└── README.md                             # Hướng dẫn chạy và tổng quan dự án
```

Sơ đồ phản ánh các file trong bản đang phát triển; các file `.gitkeep` giữ thư mục trống được lược bỏ. Dự án không còn lưu tài khoản trong `data/users.json`; tài khoản, sản phẩm, ảnh và dữ liệu nghiệp vụ nằm trên Supabase. `docs/TEAM.md`, `docs/PROJECT.md` và tài liệu Word vẫn có một số nội dung tiến độ cũ, chưa được cập nhật trong lần sửa README này.

## Kiểm thử và giới hạn

```sh
npm test
```

Lần kiểm tra ngày 28/10/2026: **42 kiểm thử đạt, 0 lỗi**. Bộ kiểm thử dùng PostgreSQL qua PGlite với dữ liệu riêng, áp dụng đầy đủ migration và không thay đổi database Supabase thật. Nội dung gồm:

- Đăng nhập, đổi mật khẩu, CSRF, phân quyền và hết hiệu lực phiên.
- Tạo/đổi quyền/khóa tài khoản, email trùng và bảo vệ admin cuối cùng.
- Thêm/sửa/ngừng danh mục, tên trùng và giữ liên kết sản phẩm.
- Sản phẩm dùng ID tự sinh, tìm kiếm/lọc, dữ liệu đầu vào và bảo vệ giá cơ sở trước nhân viên.
- Tính giá theo ngưỡng, min/max, quy tắc tắt, làm tròn, ghi lịch sử và hoàn tác khi lỗi.
- Tải/thay/gỡ ảnh, quyền xem ảnh, ảnh giả/hỏng/quá lớn và hoàn tác ảnh cùng thay đổi sản phẩm.

Kiểm tra kết nối thật bằng `npm run db:check`. Kiểm thử schema chưa thay thế việc xây dựng và kiểm thử luồng nhập kho, bán hàng, trả hàng hoặc báo cáo còn thiếu.

Phiên đăng nhập và giới hạn thử sai vẫn nằm trong RAM, mất khi khởi động lại và chưa dùng chung giữa các tiến trình. Trước khi triển khai công khai cần session store bền vững, HTTPS, cookie Secure và cấu hình host triển khai. Phần tiếp theo là dịch vụ kho/bán hàng, yêu cầu trả hàng/hàng hỏng, màn hình quy tắc giá/lịch sử giá, thống kê doanh thu và tích hợp triển khai.
