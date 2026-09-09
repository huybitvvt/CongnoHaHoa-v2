-- Destination only: an order may be assigned a different UPS shipment.
-- Keep the previous shipment's observations separate instead of attributing them to the new code.
create table public.speego_tracking_archive (
  id uuid primary key default gen_random_uuid(),
  speego_id uuid references public.speego(id) on delete set null,
  tracking_code text not null,
  observation jsonb not null,
  archived_at timestamptz not null default now()
);
create index speego_tracking_archive_order_idx on public.speego_tracking_archive(speego_id, archived_at desc);
alter table public.speego_tracking_archive enable row level security;
revoke all on public.speego_tracking_archive from anon, authenticated;
grant select on public.speego_tracking_archive to authenticated;
grant all on public.speego_tracking_archive to service_role;
create policy "authenticated users read prior shipment observations" on public.speego_tracking_archive
  for select to authenticated using (true);

create function public.speego_archive_changed_tracking()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.tracking_code is distinct from old.tracking_code then
    insert into public.speego_tracking_archive(speego_id, tracking_code, observation)
      values (old.id, old.tracking_code, jsonb_build_object(
        'status', old.status, 'raw_status', old.raw_status, 'checked_at', old.checked_at,
        'edd', old.edd, 'history', old.history, 'error', old.error));
    new.status := null;
    new.raw_status := null;
    new.checked_at := null;
    new.edd := null;
    new.error := null;
    new.history := '[]'::jsonb;
  end if;
  return new;
end;
$$;
revoke all on function public.speego_archive_changed_tracking() from public, anon, authenticated;
create trigger speego_archive_changed_tracking before update of tracking_code on public.speego
  for each row execute function public.speego_archive_changed_tracking();

-- Verify with a rolled-back subtransaction: no synthetic order or archive survives this migration.
do $$
declare
  test_id uuid := gen_random_uuid();
  old_code text := '1Z' || upper(left(replace(gen_random_uuid()::text, '-', ''), 16));
  new_code text := '1Z' || upper(left(replace(gen_random_uuid()::text, '-', ''), 16));
begin
  begin
    insert into public.speego(id, order_id, tracking_code, status, checked_at, history, collected)
      values (test_id, '#TEST-' || upper(left(test_id::text, 8)), old_code, 'Delivered', now(),
        '[{"status":"Delivered","rawStatus":"Delivered"}]'::jsonb, true);
    update public.speego set tracking_code = new_code where id = test_id;
    if not exists (select 1 from public.speego where id = test_id and status is null
        and checked_at is null and history = '[]'::jsonb and collected = true)
      or not exists (select 1 from public.speego_tracking_archive where speego_id = test_id
        and tracking_code = old_code and observation->>'status' = 'Delivered') then
      raise exception 'Tracking identity regression failed';
    end if;
    update public.speego set tracking_code = new_code where id = test_id;
    if (select count(*) from public.speego_tracking_archive where speego_id = test_id) <> 1 then
      raise exception 'Unchanged tracking code must not archive twice';
    end if;
    raise sqlstate 'ZX001' using message = 'Roll back successful regression fixture';
  exception when sqlstate 'ZX001' then null;
  end;
end;
$$;
