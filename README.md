# Kho Việt — Quản lý kho và định giá động

Ứng dụng Node.js 22 trở lên, giao diện HTML/CSS và PostgreSQL trên Supabase. Hiện đã có đăng nhập, đổi mật khẩu, phân quyền, thanh điều hướng và cơ sở dữ liệu; các màn hình nghiệp vụ vẫn là trang đang phát triển.

## Chạy ứng dụng

```sh
npm ci
npm start
```

Mở http://localhost:3000. Dùng `npm run dev` nếu muốn tự khởi động lại khi sửa mã.

Ứng dụng tự đọc `.env`. Sao chép `.env.example` cho máy mới, rồi điền chuỗi PostgreSQL từ Supabase → Connect → Session pooler vào `DATABASE_URL`. Mã hóa các ký tự đặc biệt trong mật khẩu bằng URL encoding. Không đưa `.env` lên Git hoặc gửi chuỗi kết nối trong tài liệu.

- `DATABASE_URL` là bắt buộc: đăng nhập và đổi mật khẩu chỉ dùng bảng `public.users` trên Supabase. Thiếu cấu hình hoặc kết nối lỗi thì ứng dụng báo lỗi, không tạo hay dùng tài khoản JSON thay thế.
- `DATABASE_SSL_CA_FILE` trỏ tới chứng chỉ CA công khai `database/certs/supabase-ca.crt`. Kết nối luôn xác minh chứng chỉ TLS.
- `SUPABASE_PROJECT_REF` dùng để kiểm tra chuỗi kết nối trỏ đúng dự án. Dự án hiện tại là `gbkchphcndmaoaopuqpv`.

Không có `start.bat` trong dự án. Server hiện chỉ lắng nghe loopback và chưa được triển khai lên Render.

## Cơ sở dữ liệu

```sh
npm run db:migrate
npm run db:check
```

`db:migrate` chạy các file SQL theo thứ tự trong một transaction, khóa chống chạy đồng thời và lưu checksum trong `schema_migrations`. Chạy lại không tạo lại bảng. Thay đổi schema phải thêm migration mới, không sửa migration đã áp dụng.

Hai tài khoản ban đầu đã được chuyển lên Supabase, giữ nguyên mật khẩu băm và phiên bản tài khoản. Cơ chế tạo tài khoản JSON và lệnh chuyển tài khoản một lần đã được loại bỏ. Không có sản phẩm hoặc giao dịch bán giả được thêm vào database.

Bảy bảng nghiệp vụ: `users`, `categories`, `products`, `stock_movements`, `stock_requests`, `pricing_rules`, `price_history`. `schema_migrations` là bảng kỹ thuật. Tất cả bật RLS; vai trò trình duyệt `anon` và `authenticated` không có quyền đọc hoặc ghi trực tiếp. Node.js dùng kết nối PostgreSQL riêng và kiểm tra quyền tại máy chủ; không dùng Supabase Auth ở bản hiện tại.

Ràng buộc SQL kiểm tra tồn không âm, số lượng dương, giá hữu hạn, khóa ngoại, ngưỡng định giá, SALE chỉ do nhân viên tạo, trả đúng giá gốc và không vượt số đã bán, duyệt yêu cầu chỉ một lần bởi admin. Database chưa tự cập nhật tồn hoặc giá; phần đó cần dịch vụ nghiệp vụ có transaction.

## Phân quyền

- Nhân viên: bán hàng, xem lịch sử bán của mình, tra cứu sản phẩm, cảnh báo tồn, gửi và theo dõi yêu cầu của mình.
- Admin: quản lý sản phẩm, danh mục, nhập kho, kiểm kê, duyệt yêu cầu, định giá, báo cáo và tài khoản; xem lịch sử bán của nhân viên trong nhóm Quản trị.
- Admin không được tự bán hàng hoặc vào lịch sử bán cá nhân. Route `/sales` và `/sales/history` chặn admin; `/admin/sales-history` chỉ dành cho admin.
- Các quyền nghiệp vụ trên hiện mới được áp dụng vào điều hướng, trang chờ phát triển và ràng buộc SQL, chưa có chức năng xử lý giao dịch trên giao diện.

Nhân viên vào `/admin` nhận 403. Trang chủ admin ở `/admin`, nhân viên ở `/staff`. Thao tác thay đổi dữ liệu dùng POST và kiểm tra CSRF.

## Tài khoản trên Supabase

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Admin | admin@khoviet.local | KhoViet@123 |
| Nhân viên | staff@khoviet.local | KhoViet@123 |

Email đăng nhập được giữ nguyên dù có đuôi `.local`; tài khoản được lưu trên Supabase. Bảng trên ghi thông tin đăng nhập đã xác minh tại thời điểm cập nhật; nếu đổi mật khẩu, dùng mật khẩu mới. Không công khai mật khẩu trên trang đăng nhập; hệ thống không tự sinh tài khoản mặc định.

Mật khẩu băm bằng scrypt. Đổi mật khẩu tăng `session_version` bằng cập nhật có điều kiện để chống ghi đè đồng thời và hủy phiên cũ. Vai trò, trạng thái hoạt động và phiên bản tài khoản được đọc lại từ database ở mỗi request.

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
│   │   └── pages.js                      # Trang GET, kiểm tra quyền, trang chờ nghiệp vụ
│   ├── middleware/
│   │   ├── auth.js                       # Xác thực phiên và kiểm tra vai trò
│   │   └── security.js                   # Các header bảo mật
│   ├── services/
│   │   ├── password.js                   # Băm và kiểm tra mật khẩu bằng scrypt
│   │   └── session.js                    # Tạo, hủy phiên đăng nhập lưu trong RAM
│   ├── repositories/
│   │   └── users-postgres.js             # Đọc tài khoản, đổi mật khẩu trên Supabase
│   ├── utils/
│   │   ├── html.js                       # Escape nội dung trước khi đưa vào HTML
│   │   └── http.js                       # Đọc form, chuyển hướng và trả trang HTML
│   └── views/
│       ├── layout.js                     # Bố cục chung, thanh trên và vùng nội dung
│       ├── sidebar.js                    # Thanh chức năng bên trái theo vai trò
│       ├── auth/
│       │   ├── login.js                  # Giao diện đăng nhập
│       │   └── change-password.js        # Giao diện đổi mật khẩu
│       └── dashboard/
│           └── home.js                   # Trang chủ admin và nhân viên
├── public/                               # Tệp giao diện tĩnh
│   ├── css/
│   │   └── style.css                     # Định dạng giao diện và bố cục thích ứng
│   ├── js/                               # Chưa có mã JavaScript phía trình duyệt
│   └── images/                           # Chưa có tệp ảnh
├── database/                             # Thiết lập database; dữ liệu thật ở Supabase
│   ├── certs/
│   │   ├── supabase-ca.crt                # Chứng chỉ CA công khai để xác minh TLS
│   │   └── README.md                      # Nguồn và hướng dẫn chứng chỉ
│   ├── migrations/
│   │   └── 001_inventory_pricing.sql      # Tạo 7 bảng nghiệp vụ, ràng buộc và RLS
│   └── seeds/                            # Chưa có dữ liệu mẫu
├── scripts/
│   ├── db-migrate.js                      # Chạy và theo dõi phiên bản migration
│   └── db-check.js                        # Kiểm tra kết nối, bảng và số tài khoản
├── tests/
│   ├── auth.test.js                       # Đăng nhập, đổi mật khẩu và yêu cầu database
│   ├── navigation.test.js                 # Menu và quyền truy cập theo vai trò
│   └── database.test.js                   # Ràng buộc PostgreSQL và repository tài khoản
├── docs/
│   ├── TEAM.md                           # Phân công và hướng dẫn phối hợp 4 thành viên
│   ├── PROJECT.md                        # Thiết kế và tiến độ dự án
│   └── Inventory_Dynamic_Pricing_Supabase.docx  # Tài liệu Word cập nhật
├── node_modules/                         # Thư viện do npm cài, không đưa lên Git
├── .env                                  # Kết nối riêng của máy, không đưa lên Git
├── .env.example                          # Mẫu cấu hình không chứa mật khẩu database
├── .gitignore                            # Loại trừ cấu hình riêng và thư viện khỏi Git
├── package.json                          # Thư viện, yêu cầu Node.js và lệnh chạy
├── package-lock.json                     # Khóa phiên bản thư viện
└── README.md                             # Hướng dẫn chạy và tổng quan dự án
```

Sơ đồ phản ánh các file hiện có; các file `.gitkeep` giữ thư mục trống được lược bỏ. Các module nghiệp vụ mới sẽ được bổ sung theo `docs/TEAM.md`. Dự án không còn lưu tài khoản trong `data/users.json`; tài khoản và dữ liệu nghiệp vụ nằm trên Supabase.

## Kiểm thử và giới hạn

```sh
npm test
```

Kiểm thử xác thực và schema dùng PostgreSQL qua PGlite với tài khoản kiểm thử riêng, không ghi file tài khoản local. Các kiểm thử mặc định không thay đổi database thật. Kiểm tra kết nối thật bằng `npm run db:check`.

Phiên đăng nhập và giới hạn thử sai vẫn nằm trong RAM, mất khi khởi động lại và chưa dùng chung giữa các tiến trình. Trước khi triển khai công khai cần session store bền vững, HTTPS, cookie Secure và cấu hình host triển khai. Quản lý tài khoản, sản phẩm, giao dịch kho và định giá vẫn cần triển khai tiếp.
