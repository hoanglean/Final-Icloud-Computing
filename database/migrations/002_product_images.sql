ALTER TABLE public.products
  ADD COLUMN image_data bytea,
  ADD CONSTRAINT products_image_size CHECK (
    image_data IS NULL OR octet_length(image_data) BETWEEN 1 AND 2097152
  );
