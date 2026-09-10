-- Destination runner controls only; no changes to source or shipment data.
alter table public.speego_runner drop constraint speego_runner_requested_concurrency_check;
alter table public.speego_runner add constraint speego_runner_requested_concurrency_check
  check (requested_concurrency between 1 and 30);
alter table public.speego_runner alter column requested_concurrency set default 30;
update public.speego_runner set requested_concurrency = 30 where id = true;
