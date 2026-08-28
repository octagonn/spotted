-- HOTFIX: on_auth_user_login (added 2026-08-25) broke sign-up. Auth updates
-- last_sign_in_at when a NEW user verifies, before their profile row exists;
-- the user_activity insert then violated its FK to profiles and the whole
-- auth transaction failed with "Database error granting user" (email OTP and
-- Apple alike). An auth trigger must never be able to fail auth.
create or replace function public.sync_last_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No profile yet (brand-new account): the profile-insert trigger below
  -- backfills the login time once the profile exists.
  if not exists (select 1 from profiles where id = new.id) then
    return new;
  end if;
  insert into user_activity (user_id, last_login_at, updated_at)
  values (new.id, new.last_sign_in_at, now())
  on conflict (user_id)
  do update set last_login_at = excluded.last_login_at, updated_at = now();
  return new;
exception when others then
  -- Analytics bookkeeping is never worth a failed login.
  return new;
end $$;

-- When the profile is created, pick up the login time auth already recorded.
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
  insert into user_activity (user_id, last_login_at, updated_at)
  select new.id, u.last_sign_in_at, now() from auth.users u where u.id = new.id
  on conflict (user_id) do update set last_login_at = coalesce(excluded.last_login_at, user_activity.last_login_at);
  return new;
exception when others then
  -- Never block profile creation on analytics bookkeeping.
  return new;
end $$;
