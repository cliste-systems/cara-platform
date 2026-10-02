-- Exact-name fallback for store-assortment identity checks must not scan the full catalogue.
set lock_timeout = '2s';
create index if not exists retail_catalog_products_banner_product_name_idx
  on public.retail_catalog_products (retail_banner, product_name);
