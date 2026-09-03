-- Self-healing gym pins.
--
-- Gym coordinates come from Foursquare/OSM centroids that are routinely
-- 50-400m off the actual building (Crunch Fitness Auburn AL sat ~320m west of
-- the gym), which makes the 75m check-in geofence unreachable no matter where
-- the member stands. The old answer, refine_gym_location, was never called by
-- the app and was hard-bounded to Orange County anyway.
--
-- This migration replaces it with:
--   1) fix_gym_pin: a user standing at a gym snaps its pin to their GPS
--      position. Works for any gym anywhere; guarded (proximity cap, GPS
--      accuracy requirement, rate limits) and fully audited (gym_pin_fixes).
--   2) pin_locked + trigger: once a human has placed a pin, background
--      re-seeding from Foursquare/OSM can never overwrite it.
--   3) checkin() accepts the GPS fix accuracy and adds a capped leniency
--      margin, so an accurate pin plus normal urban GPS drift still verifies.

drop function if exists public.refine_gym_location(uuid, double precision, double precision);

-- ---------------------------------------------------------------------------
-- Audit trail: every pin move, with enough to revert it.
create table if not exists public.gym_pin_fixes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  old_latitude double precision not null,
  old_longitude double precision not null,
  new_latitude double precision not null,
  new_longitude double precision not null,
  moved_meters double precision not null,
  gps_accuracy_m double precision,
  created_at timestamptz not null default now()
);
create index if not exists gym_pin_fixes_user_recent_idx on public.gym_pin_fixes (user_id, created_at desc);
alter table public.gym_pin_fixes enable row level security;
-- No policies on purpose: rows are written only through the security-definer
-- RPC below and read only by operators.

-- ---------------------------------------------------------------------------
-- Human-placed pins survive re-seeding. seed-gyms-fsq upserts latitude and
-- longitude on external_id conflicts, which would silently undo a fix; this
-- trigger keeps locked coordinates unless the change comes through
-- fix_gym_pin (which flags itself via a session setting).
alter table public.gyms add column if not exists pin_locked boolean not null default false;

create or replace function public.protect_locked_gym_pin() returns trigger
language plpgsql
as $$
begin
  if old.pin_locked
     and (new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude)
     and coalesce(current_setting('spotted.allow_pin_move', true), '') <> '1' then
    new.latitude := old.latitude;
    new.longitude := old.longitude;
  end if;
  return new;
end;
$$;

drop trigger if exists gyms_protect_locked_pin on public.gyms;
create trigger gyms_protect_locked_pin before update on public.gyms
  for each row execute function public.protect_locked_gym_pin();

-- ---------------------------------------------------------------------------
-- The fix itself.
create or replace function public.fix_gym_pin(
  p_gym_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null
) returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_gym gyms%rowtype;
  v_moved double precision;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    return 'invalid_coordinates';
  end if;
  -- A coarse fix would move the pin somewhere worse than where it is.
  if p_accuracy_m is null or p_accuracy_m > 65 then
    return 'gps_too_coarse';
  end if;
  select * into v_gym from gyms where id = p_gym_id;
  if v_gym.id is null then
    return 'gym_not_found';
  end if;
  v_moved := earth_distance(ll_to_earth(v_gym.latitude, v_gym.longitude), ll_to_earth(p_latitude, p_longitude));
  -- Caller must actually be at the gym. Source-data errors run 50-400m, so
  -- 600m accepts every real mislocation while blocking dragging a pin across
  -- town (which would enable fake verified check-ins from home).
  if v_moved > 600 then
    return 'too_far_from_gym';
  end if;
  if v_moved < 10 then
    return 'already_accurate';
  end if;
  -- One fix per user per gym per day, five per user per day overall.
  if exists (
    select 1 from gym_pin_fixes
    where user_id = auth.uid() and gym_id = p_gym_id and created_at > now() - interval '1 day'
  ) then
    return 'rate_limited';
  end if;
  if (select count(*) from gym_pin_fixes
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    return 'rate_limited';
  end if;
  insert into gym_pin_fixes
    (gym_id, user_id, old_latitude, old_longitude, new_latitude, new_longitude, moved_meters, gps_accuracy_m)
  values
    (p_gym_id, auth.uid(), v_gym.latitude, v_gym.longitude, p_latitude, p_longitude, v_moved, p_accuracy_m);
  perform set_config('spotted.allow_pin_move', '1', true);
  update gyms set latitude = p_latitude, longitude = p_longitude, pin_locked = true where id = p_gym_id;
  perform set_config('spotted.allow_pin_move', '', true);
  return 'fixed';
end;
$$;
revoke execute on function public.fix_gym_pin(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.fix_gym_pin(uuid, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Check-in verification: allow for the phone's reported GPS accuracy, capped
-- at 50m so a wildly coarse fix can't verify from the parking lot next door.
-- Dropped and recreated (not overloaded) so PostgREST has exactly one
-- candidate; existing clients that omit p_accuracy_m hit the default.
drop function if exists public.checkin(uuid, double precision, double precision, boolean);

create or replace function public.checkin(
  p_gym_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_verified boolean default true,
  p_accuracy_m double precision default null
) returns uuid as $$
declare
  gym gyms%rowtype;
  active_id uuid;
  created_id uuid;
  verified_distance boolean;
begin
  select * into gym from gyms where id = p_gym_id;
  if gym.id is null then
    raise exception 'gym_not_found';
  end if;
  verified_distance :=
    earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(gym.latitude, gym.longitude))
      <= gym.geofence_radius_meters + least(greatest(coalesce(p_accuracy_m, 0), 0), 50);
  select id into active_id from checkins where user_id = auth.uid() and gym_id = p_gym_id and checked_out_at is null order by checked_in_at desc limit 1;
  if active_id is not null then
    return active_id;
  end if;
  insert into checkins (user_id, gym_id, source, verified)
  values (auth.uid(), p_gym_id, 'geofence', p_verified and verified_distance)
  returning id into created_id;
  return created_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Re-apply 0006's lockdown to the recreated signature.
revoke execute on function public.checkin(uuid, double precision, double precision, boolean, double precision) from public, anon;
grant execute on function public.checkin(uuid, double precision, double precision, boolean, double precision) to authenticated;
