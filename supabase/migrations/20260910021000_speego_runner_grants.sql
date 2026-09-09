-- Supabase projects can have permissive default table grants. Restrict them explicitly.
revoke all on public.speego_runner from authenticated, anon;
grant select on public.speego_runner to authenticated;
grant update (enabled, requested_concurrency) on public.speego_runner to authenticated;
grant all on public.speego_runner to service_role;
