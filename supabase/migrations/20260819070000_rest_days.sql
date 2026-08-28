-- Rest / recovery days (requested twice by Ryan).
--
-- Semantics: a rest day FREEZES the streak. It stops the streak breaking but
-- does NOT increment it, so a 5-day streak plus a rest day is still 5 and
-- becomes 6 on the next real gym day. That keeps the streak number meaning
-- "days you actually trained" while not punishing planned recovery.
--
-- Rest days live in the SAME gym_days ledger as gym days, so the calendar, the
-- split, the streak and trophies all read one source of truth. The matching
-- client half is lib/streak.ts::computeGymStreak — the two MUST agree or the
-- profile and the server will report different streaks.

alter table public.gym_days
  add column if not exists kind text not null default 'gym';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.gym_days'::regclass and conname = 'gym_days_kind_check'
  ) then
    alter table public.gym_days
      add constraint gym_days_kind_check check (kind in ('gym', 'rest'));
  end if;
end $$;

-- A real post always wins: posting on a day marked as rest converts it back to
-- a gym day (previously this only refreshed post_id).
create or replace function public.record_gym_day()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  tz text;
  local_day date;
begin
  if not new.is_daily_drop then return new; end if;
  select timezone into tz from profiles where id = new.user_id;
  local_day := (new.created_at at time zone coalesce(nullif(tz, ''), 'UTC'))::date;
  insert into gym_days (user_id, day, post_id, kind)
  values (new.user_id, local_day, new.id, 'gym')
  on conflict (user_id, day) do update
    set post_id = excluded.post_id,
        kind = 'gym';
  return new;
end $function$;

-- Mark (or clear) today as a rest day.
--
-- Guarded deliberately, because a freeze that can be spammed makes the streak
-- meaningless:
--   * the caller's OWN ledger only (no user parameter — auth.uid() only), and
--     only their local TODAY, so gaps can't be backfilled to resurrect a
--     lapsed streak
--   * never overwrites or deletes a day that has a real post
--   * at most rest_cap rest days in any rolling 7 local days
--
-- rest_cap = 2/week is an assumption rather than a stated requirement; it is a
-- single constant below if it should be looser or tighter.
create or replace function public.mark_rest_day(p_rest boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_today date;
  v_existing gym_days%rowtype;
  v_recent int;
  rest_cap constant int := 2;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select coalesce(nullif(timezone, ''), 'UTC') into v_tz from profiles where id = v_user;
  if v_tz is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  v_today := (now() at time zone v_tz)::date;

  select * into v_existing from gym_days where user_id = v_user and day = v_today;

  -- Clearing: only ever removes a rest marker, never a real post.
  if not p_rest then
    if found and v_existing.kind = 'rest' then
      delete from gym_days where user_id = v_user and day = v_today;
      return jsonb_build_object('ok', true, 'kind', null);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'not_a_rest_day');
  end if;

  if found and v_existing.post_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_posted');
  end if;
  if found and v_existing.kind = 'rest' then
    return jsonb_build_object('ok', true, 'kind', 'rest');
  end if;

  select count(*) into v_recent
  from gym_days
  where user_id = v_user
    and kind = 'rest'
    and day > v_today - 7
    and day <= v_today;

  if v_recent >= rest_cap then
    return jsonb_build_object('ok', false, 'reason', 'rest_cap_reached', 'cap', rest_cap);
  end if;

  insert into gym_days (user_id, day, post_id, kind)
  values (v_user, v_today, null, 'rest')
  on conflict (user_id, day) do update set kind = 'rest'
  where gym_days.post_id is null;

  return jsonb_build_object('ok', true, 'kind', 'rest', 'day', v_today);
end $function$;

revoke all on function public.mark_rest_day(boolean) from public, anon;
grant execute on function public.mark_rest_day(boolean) to authenticated;
