alter table public.speego
  add column source_order_id text,
  add column source_order_code text,
  add column email text,
  add column address text,
  add column city text,
  add column state text,
  add column postal_code text,
  add column country text,
  add column marketing_staff text,
  add column sales_person text,
  add column customer_service_staff text,
  add column delivery_person text,
  add column shipping_unit text,
  add column unit_price numeric(14, 2) check (unit_price is null or unit_price >= 0),
  add column currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  add column exchange_rate numeric(16, 6) check (exchange_rate is null or exchange_rate >= 0),
  add column total_amount_vnd numeric(18, 2) check (total_amount_vnd is null or total_amount_vnd >= 0),
  add column source_updated_at timestamptz,
  add column source_synced_at timestamptz;

create unique index speego_source_order_id_key
on public.speego (source_order_id)
where source_order_id is not null;
