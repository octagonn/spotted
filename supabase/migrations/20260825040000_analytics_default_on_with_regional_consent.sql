-- First-party usage analytics is on by default (disclosed in the privacy
-- policy, opt-out in Settings -> Privacy). EEA/UK users are still asked for
-- opt-in consent by the client, which reads `basis`:
--   consent  - user affirmatively opted in (prompt or toggle)
--   default  - on by default, never affirmatively consented
--   declined - user turned it off
-- Collection is client-initiated; RLS remains the backstop (row must be enabled).

-- 1. The event-name CHECK was pinned to the original 14 events and would
--    reject the expanded taxonomy. Keep a shape check only.
alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events
  add constraint analytics_events_event_name_check check (event_name ~ '^[a-z][a-z0-9_]{1,47}$');

-- 2. Consent basis
alter table public.analytics_preferences
  add column if not exists basis text not null default 'default'
  check (basis in ('consent', 'default', 'declined'));

update public.analytics_preferences set basis = 'consent'
where product_analytics_enabled and basis <> 'consent';

-- Users who tapped "Not now" on the old (over-broad) prompt: default-on, with
-- prompted_at preserved so they can be identified for the in-app notice.
update public.analytics_preferences
set product_analytics_enabled = true, basis = 'default', consent_version = '2026-08-25', updated_at = now()
where not product_analytics_enabled;

-- Users never prompted at all.
insert into public.analytics_preferences (user_id, product_analytics_enabled, sale_sharing_opt_out, consent_version, prompted_at, consented_at, basis)
select p.id, true, true, '2026-08-25', null, null, 'default'
from public.profiles p
where not exists (select 1 from public.analytics_preferences a where a.user_id = p.id);

alter table public.analytics_preferences alter column product_analytics_enabled set default true;
alter table public.analytics_preferences alter column consent_version set default '2026-08-25';

-- 3. New signups get a default-on row with their profile.
create or replace function public.default_analytics_preference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into analytics_preferences (user_id, product_analytics_enabled, basis)
  values (new.id, true, 'default')
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists profiles_default_analytics on public.profiles;
create trigger profiles_default_analytics
  after insert on public.profiles
  for each row execute function public.default_analytics_preference();
