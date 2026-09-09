create table public.speego (
  id uuid primary key default gen_random_uuid(),
  order_id text not null check (order_id ~ '^#[A-Z0-9-]{2,31}$'),
  tracking_code text not null unique check (tracking_code ~ '^[A-Z0-9]{7,34}$'),
  carrier text not null default 'UPS' check (carrier = 'UPS'),
  customer_name text,
  phone text,
  order_date date not null default current_date,
  amount numeric(14, 2) check (amount is null or amount >= 0),
  edd date,
  collected boolean not null default false,
  status text,
  raw_status text,
  checked_at timestamptz,
  error text,
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index speego_order_id_key on public.speego (upper(order_id));
create index speego_checked_at_idx on public.speego (checked_at desc nulls last);
create index speego_order_date_idx on public.speego (order_date desc);

create trigger speego_set_updated_at before update on public.speego
for each row execute function public.set_updated_at();

alter table public.speego enable row level security;

create policy "authenticated users manage speego orders" on public.speego
for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.speego to authenticated;
revoke all on public.speego from anon;
