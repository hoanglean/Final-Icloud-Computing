-- Gia minh hoa cho do an (VND), khong phai bao gia thi truong.
-- San pham bat dau voi ton 0; nhap hang qua nghiep vu kho.
-- Chay lai khong ghi de danh muc, gia, ton hoac san pham da co.
BEGIN;

INSERT INTO public.categories(name) VALUES
  ('Đồ uống'),
  ('Bánh kẹo'),
  ('Thực phẩm thiết yếu'),
  ('Chăm sóc cá nhân')
ON CONFLICT (lower(btrim(name))) DO NOTHING;

INSERT INTO public.products(sku, name, category_id, base_price, current_price)
SELECT sample.sku, sample.name, category.id, sample.price, sample.price
FROM (VALUES
  ('DEMO-DU-001', 'Nước suối chai 500 ml', 'Đồ uống', 5000),
  ('DEMO-DU-002', 'Trà xanh chai 450 ml', 'Đồ uống', 10000),
  ('DEMO-DU-003', 'Nước ngọt lon 330 ml', 'Đồ uống', 12000),
  ('DEMO-DU-004', 'Sữa tươi không đường hộp 180 ml', 'Đồ uống', 8000),
  ('DEMO-DU-005', 'Cà phê lon 240 ml', 'Đồ uống', 15000),
  ('DEMO-BK-001', 'Bánh quy bơ hộp 200 g', 'Bánh kẹo', 35000),
  ('DEMO-BK-002', 'Bánh xốp sô cô la gói 150 g', 'Bánh kẹo', 20000),
  ('DEMO-BK-003', 'Kẹo sữa gói 100 g', 'Bánh kẹo', 15000),
  ('DEMO-BK-004', 'Snack khoai tây gói 60 g', 'Bánh kẹo', 12000),
  ('DEMO-BK-005', 'Bánh gạo gói 150 g', 'Bánh kẹo', 25000),
  ('DEMO-TP-001', 'Mì ăn liền gói 75 g', 'Thực phẩm thiết yếu', 5000),
  ('DEMO-TP-002', 'Mì ly 65 g', 'Thực phẩm thiết yếu', 12000),
  ('DEMO-TP-003', 'Gạo túi 5 kg', 'Thực phẩm thiết yếu', 95000),
  ('DEMO-TP-004', 'Dầu ăn chai 1 lít', 'Thực phẩm thiết yếu', 50000),
  ('DEMO-TP-005', 'Nước mắm chai 500 ml', 'Thực phẩm thiết yếu', 35000),
  ('DEMO-CS-001', 'Dầu gội chai 350 ml', 'Chăm sóc cá nhân', 65000),
  ('DEMO-CS-002', 'Sữa tắm chai 650 ml', 'Chăm sóc cá nhân', 80000),
  ('DEMO-CS-003', 'Kem đánh răng tuýp 180 g', 'Chăm sóc cá nhân', 35000),
  ('DEMO-CS-004', 'Bàn chải đánh răng lông mềm', 'Chăm sóc cá nhân', 15000),
  ('DEMO-CS-005', 'Nước rửa tay chai 500 ml', 'Chăm sóc cá nhân', 40000)
) AS sample(sku, name, category_name, price)
JOIN public.categories category ON lower(btrim(category.name)) = lower(sample.category_name)
WHERE category.is_active = true
ON CONFLICT (sku) DO NOTHING;

COMMIT;
