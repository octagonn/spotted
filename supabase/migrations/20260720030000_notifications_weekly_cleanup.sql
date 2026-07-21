-- Notifications older than 7 days are swept daily (pg_cron); the client also
-- filters to the last week. (2026-07-20)
create or replace function public.notifications_cleanup_sweep() returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  delete from notifications where created_at < now() - interval ''7 days'';
  get diagnostics v_count = row_count;
  return v_count;
end $$;
select cron.schedule(
  ''notifications-cleanup'',
  ''15 4 * * *'',
  $q$select public.notifications_cleanup_sweep()$q$
);
