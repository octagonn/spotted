-- 0008_cron_and_push.sql
-- Makes the backend self-running:
--   1. Ports the checkout-stale and streak-tick edge functions to SQL and schedules
--      them with pg_cron (no HTTP hop, atomic, no secrets needed).
--   2. Adds a DB webhook: every insert into notifications POSTs to the send-push
--      edge function via pg_net so pushes are actually delivered.
--      (The Authorization header uses the project anon key, which is public by
--      design — send-push runs verify_jwt and then uses the service role internally.)

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- 1a. Stale checkout sweep (was supabase/functions/checkout-stale)
create or replace function public.checkout_stale_sweep()
returns integer
language sql
security definer
set search_path = public
as $$
  with closed as (
    update checkins
    set checked_out_at = now()
    where checked_out_at is null
      and checked_in_at < now() - interval '3 hours'
    returning id
  )
  select count(*)::int from closed;
$$;

-- 1b. Streak tick (was supabase/functions/streak-tick)
-- Runs every 15 minutes; only acts on profiles whose local midnight fell inside
-- the last 15-minute window. For each such user with a scheduled (non-Rest)
-- workout yesterday and no verified checkin: spend a freeze token if available,
-- otherwise break the streak, record a skip_event, and notify accepted friends.
create or replace function public.streak_tick_sweep()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_groups text[];
  v_streak streaks%rowtype;
  v_processed int := 0;
  v_prev timestamptz := now() - interval '15 minutes';
  v_sched_date date;
  v_weekday int;
begin
  for r in select id, timezone, display_name from profiles loop
    if (now() at time zone r.timezone)::date = (v_prev at time zone r.timezone)::date then
      continue;
    end if;
    v_sched_date := (v_prev at time zone r.timezone)::date;
    v_weekday := extract(dow from v_sched_date)::int;

    select muscle_groups into v_groups
    from workout_schedule
    where user_id = r.id and day_of_week = v_weekday;
    if v_groups is null or cardinality(v_groups) = 0 or 'Rest' = any(v_groups) then
      continue;
    end if;

    if exists (
      select 1 from checkins c
      where c.user_id = r.id
        and c.verified
        and (c.checked_in_at at time zone r.timezone)::date = v_sched_date
    ) then
      continue;
    end if;

    select * into v_streak from streaks where user_id = r.id;
    if found and v_streak.freeze_tokens > 0 then
      update streaks set freeze_tokens = freeze_tokens - 1 where user_id = r.id;
      v_processed := v_processed + 1;
      continue;
    end if;

    update streaks set current_streak = 0 where user_id = r.id;
    insert into skip_events (user_id, scheduled_date, muscle_groups_missed, notified_friends)
    values (r.id, v_sched_date, v_groups, true)
    on conflict (user_id, scheduled_date) do nothing;

    insert into notifications (recipient_id, actor_id, type, payload)
    select case when f.user_id = r.id then f.friend_id else f.user_id end,
           r.id,
           'streak_break_friend',
           jsonb_build_object(
             'actorName', r.display_name,
             'muscleGroup', v_groups[1],
             'streakCount', coalesce(v_streak.current_streak, 0)
           )
    from friendships f
    where f.status = 'accepted' and (f.user_id = r.id or f.friend_id = r.id);

    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;

revoke execute on function public.checkout_stale_sweep() from public, anon, authenticated;
revoke execute on function public.streak_tick_sweep() from public, anon, authenticated;

select cron.schedule('checkout-stale', '10 * * * *', 'select public.checkout_stale_sweep()');
select cron.schedule('streak-tick', '*/15 * * * *', 'select public.streak_tick_sweep()');

-- ---------------------------------------------------------------------------
-- 2. Push fan-out: notifications insert -> send-push edge function
create or replace function public.enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://nvywxqntsrlrmlrpfuub.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eXd4cW50c3Jscm1scnBmdXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTY2NjcsImV4cCI6MjA5Mjk5MjY2N30.xTaKHGBjL4w_P8nORyS85r3gguETo8iZSORLEA6k4Bc'
    ),
    body := jsonb_build_object('notification_id', new.id::text)
  );
  return new;
exception when others then
  -- push delivery must never block the notification write
  return new;
end;
$$;

revoke execute on function public.enqueue_push() from public, anon, authenticated;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.enqueue_push();
