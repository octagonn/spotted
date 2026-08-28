-- The daily nudge said "2 day streak" to a user whose profile showed 7.
--
-- Two streak systems had drifted apart. The profile computes from the
-- gym_days ledger (lib/streak.ts: rest days BRIDGE the run without counting).
-- The nudge read the legacy `streaks` table, which only a trigger on
-- `checkins` maintains — naive consecutive-calendar-day logic, no rest days,
-- and a data source most daily posts never touch. Spot check: ryan 0 vs 8
-- ledger days, tyler 2 vs 8, ethan 1 vs 8.
--
-- gym_streak_count is the SQL mirror of computeGymStreak and must stay in
-- lockstep with it:
--   * anchor on today if covered (gym OR rest row), else yesterday, else 0
--   * walk back while covered; count only kind='gym'
--   * a run of nothing but rest days is not a streak
create or replace function public.gym_streak_count(p_user uuid, p_tz text default 'UTC')
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone coalesce(nullif(p_tz, ''), 'UTC'))::date;
  v_cursor date;
  v_kind text;
  v_count integer := 0;
begin
  if exists (select 1 from gym_days g where g.user_id = p_user and g.day = v_today) then
    v_cursor := v_today;
  elsif exists (select 1 from gym_days g where g.user_id = p_user and g.day = v_today - 1) then
    v_cursor := v_today - 1;
  else
    return 0;
  end if;
  loop
    select g.kind into v_kind from gym_days g where g.user_id = p_user and g.day = v_cursor;
    exit when v_kind is null;
    if v_kind = 'gym' then
      v_count := v_count + 1;
    end if;
    v_cursor := v_cursor - 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.gym_streak_count(uuid, text) from public, anon;

create or replace function public.daily_nudge_sweep()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_local date;
  v_streak integer;
  v_broke_yesterday boolean;
  v_text text;
  v_sent integer := 0;
begin
  for r in
    select np.user_id, np.timezone, np.daily_nudge_time
    from notification_preferences np
    where np.gym_reminders_enabled = true
  loop
    if (now() at time zone coalesce(nullif(r.timezone,''),'UTC'))::time
         not between r.daily_nudge_time and r.daily_nudge_time + interval '15 min' then
      continue;
    end if;
    v_local := (now() at time zone coalesce(nullif(r.timezone,''),'UTC'))::date;
    if exists (select 1 from posts p where p.user_id = r.user_id
                 and (p.created_at at time zone coalesce(nullif(r.timezone,''),'UTC'))::date = v_local) then
      continue;
    end if;
    -- A declared rest day is an answer, not an absence — "don't break it
    -- today" to someone who already marked today as rest is nagging.
    if exists (select 1 from gym_days g
                 where g.user_id = r.user_id and g.day = v_local and g.kind = 'rest') then
      continue;
    end if;
    -- Ledger truth, same number the profile shows (rest days bridge).
    v_streak := gym_streak_count(r.user_id, r.timezone);
    -- Broke it yesterday: trained the day before yesterday, nothing since.
    v_broke_yesterday := v_streak = 0 and exists (
      select 1 from gym_days g
      where g.user_id = r.user_id and g.day = v_local - 2 and g.kind = 'gym'
    );
    if v_broke_yesterday then
      v_text := 'Streak reset. Start a new one today.';
    elsif coalesce(v_streak,0) > 0 then
      v_text := v_streak || ' day streak. Don''t break it today.';
    else
      v_text := case when (extract(epoch from now())::bigint % 2 = 0)
        then 'Haven''t seen you at the gym today.'
        else 'Feed''s locked. You know what unlocks it.' end;
    end if;
    if dispatch_notification(r.user_id, null, 'daily_nudge',
         'daily_nudge:' || v_local::text,
         jsonb_build_object('text', v_text, 'route', '/(tabs)/feed')) then
      v_sent := v_sent + 1;
    end if;
  end loop;
  return v_sent;
end $$;
revoke all on function public.daily_nudge_sweep() from public, anon, authenticated;
