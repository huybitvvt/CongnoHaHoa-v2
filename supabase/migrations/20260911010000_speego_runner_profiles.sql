-- Destination runner control: choose how many dedicated Chrome profiles are active.
alter table public.speego_runner
  add column requested_profiles integer not null default 3
  check (requested_profiles between 1 and 3);

grant update (requested_profiles) on public.speego_runner to authenticated;
