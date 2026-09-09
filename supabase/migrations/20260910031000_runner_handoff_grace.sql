-- A coordinator stops claiming after 60s without control contact; local jobs lease for 120s.
-- Leave enough grace before a second machine takes over, so outstanding browser jobs can expire.
create or replace function public.speego_runner_heartbeat(p_owner uuid, p_machine text, p_stats jsonb)
returns setof public.speego_runner
language sql security definer set search_path = public
as $$
  update public.speego_runner
  set owner_id = p_owner, machine_name = left(p_machine, 100), heartbeat_at = now(), stats = p_stats
  where id = true and (owner_id = p_owner or heartbeat_at is null or heartbeat_at < now() - interval '5 minutes')
  returning *;
$$;
revoke all on function public.speego_runner_heartbeat(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.speego_runner_heartbeat(uuid, text, jsonb) to service_role;
