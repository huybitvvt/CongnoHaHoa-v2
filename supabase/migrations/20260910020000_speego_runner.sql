-- Destination only. No access or writes to the source project.
create table public.speego_runner (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  requested_concurrency integer not null default 6 check (requested_concurrency between 1 and 12),
  owner_id uuid,
  heartbeat_at timestamptz,
  machine_name text,
  stats jsonb not null default '{}'::jsonb
);
insert into public.speego_runner (id) values (true);
alter table public.speego_runner enable row level security;
create policy "read runner status" on public.speego_runner for select to authenticated using (true);
create policy "admins control runner" on public.speego_runner for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
grant select on public.speego_runner to authenticated;
grant update (enabled, requested_concurrency) on public.speego_runner to authenticated;
revoke all on public.speego_runner from anon;

-- At most one coordinator per destination; browser profiles share its durable queue.
create function public.speego_runner_heartbeat(p_owner uuid, p_machine text, p_stats jsonb)
returns setof public.speego_runner
language sql security definer set search_path = public
as $$
  update public.speego_runner
  set owner_id = p_owner, machine_name = left(p_machine, 100), heartbeat_at = now(), stats = p_stats
  where id = true and (owner_id = p_owner or heartbeat_at is null or heartbeat_at < now() - interval '2 minutes')
  returning *;
$$;
revoke all on function public.speego_runner_heartbeat(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.speego_runner_heartbeat(uuid, text, jsonb) to service_role;
