-- Withdrawing analytics consent atomically removes retained raw events.
create or replace function public.purge_analytics_events_on_opt_out()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.product_analytics_enabled and not new.product_analytics_enabled then
    delete from public.analytics_events where user_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.purge_analytics_events_on_opt_out()
  from public, anon, authenticated;

create trigger analytics_preferences_opt_out_purge
after update of product_analytics_enabled on public.analytics_preferences
for each row execute function public.purge_analytics_events_on_opt_out();
