# Chứng chỉ kết nối Supabase

`supabase-ca.crt` là chứng chỉ CA công khai từ Supabase, không phải mật khẩu hay khóa riêng.

Nguồn tải: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Ứng dụng bật xác minh chứng chỉ TLS. Khi Supabase thay CA, tải chứng chỉ tương ứng từ Database Settings, cập nhật file và kiểm tra lại kết nối; không tắt xác minh TLS.
