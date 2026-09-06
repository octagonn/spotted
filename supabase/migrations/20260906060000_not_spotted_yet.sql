-- "Not spotted yet" — the home-feed rail that replaces stories.
--
-- One server read tells the client, per friend, whether they trained today
-- (their local day, gym_days ledger OR any post), whether they declared a
-- rest day, their live streak, and whether I already taunted them today (and
-- whether that taunt was answered). Previously three client queries
-- approximated this with the CLIENT's midnight for everyone.
--
-- Also fixes the loop closure: answer_taunts_on_post credited a taunt only if
-- the post landed within 3 h of it (9 credited vs 25 same-day answers in the
-- data). A taunt is answered by any post on the target's same local day.
--
-- send_taunt_line gains two guards: a declared rest day cannot be taunted
-- (a rest day is an answer, not an absence — same rule as the nudge), and a
-- taunt only lands 07:00–21:59 target-local (no 2 a.m. push).

-- ---------------------------------------------------------------------------
-- friends_not_spotted_today(): every accepted friend + today's state.
-- ---------------------------------------------------------------------------
create or replace function public.friends_not_spotted_today()
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  went_today boolean,
  rest_today boolean,
  current_streak integer,
  taunted_by_me_today boolean,
  answered boolean,
  taunt_id uuid
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  my_tz text;
  my_since timestamptz;
begin
  if uid is null then return; end if;
  select coalesce(nullif(p.timezone, ''), 'UTC') into my_tz from profiles p where p.id = uid;
  my_tz := coalesce(my_tz, 'UTC');
  my_since := date_trunc('day', now() at time zone my_tz) at time zone my_tz;

  return query
  with friends as (
    select case when f.user_id = uid then f.friend_id else f.user_id end as fid
    from friendships f
    where f.status = 'accepted' and (f.user_id = uid or f.friend_id = uid)
  ),
  fr as (
    select
      p.id, p.username, p.display_name, p.avatar_url,
      coalesce(nullif(p.timezone, ''), 'UTC') as tz,
      (now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date as local_day,
      date_trunc('day', now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))
        at time zone coalesce(nullif(p.timezone, ''), 'UTC') as local_since
    from friends
    join profiles p on p.id = friends.fid
  ),
  my_taunt as (
    -- Latest taunt I sent each friend today (my local day, same window the
    -- already_taunted_target guard uses).
    select distinct on (t.target_id) t.target_id, t.id, t.answered_post_id
    from taunts t
    where t.sender_id = uid and t.sent_at >= my_since
    order by t.target_id, t.sent_at desc
  )
  select
    fr.id,
    fr.username,
    fr.display_name,
    fr.avatar_url,
    (
      exists (select 1 from gym_days g where g.user_id = fr.id and g.day = fr.local_day and g.kind = 'gym')
      or exists (select 1 from posts po where po.user_id = fr.id and po.created_at >= fr.local_since)
    ) as went_today,
    exists (select 1 from gym_days g where g.user_id = fr.id and g.day = fr.local_day and g.kind = 'rest') as rest_today,
    gym_streak_count(fr.id, fr.tz) as current_streak,
    (mt.id is not null) as taunted_by_me_today,
    (mt.answered_post_id is not null) as answered,
    mt.id as taunt_id
  from fr
  left join my_taunt mt on mt.target_id = fr.id
  order by fr.username;
end;
$function$;

revoke all on function public.friends_not_spotted_today() from public, anon;
grant execute on function public.friends_not_spotted_today() to authenticated;

-- ---------------------------------------------------------------------------
-- my_taunts_received_today(): who taunted ME today (LockOverlay strip).
-- ---------------------------------------------------------------------------
create or replace function public.my_taunts_received_today()
returns table (
  taunt_id uuid,
  sender_id uuid,
  username text,
  display_name text,
  avatar_url text,
  line_id text,
  sent_at timestamptz,
  answered boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  my_tz text;
  my_since timestamptz;
begin
  if uid is null then return; end if;
  select coalesce(nullif(p.timezone, ''), 'UTC') into my_tz from profiles p where p.id = uid;
  my_tz := coalesce(my_tz, 'UTC');
  my_since := date_trunc('day', now() at time zone my_tz) at time zone my_tz;

  return query
  select t.id, t.sender_id, p.username, p.display_name, p.avatar_url, t.line_id, t.sent_at,
         (t.answered_post_id is not null) as answered
  from taunts t
  join profiles p on p.id = t.sender_id
  where t.target_id = uid
    and t.sent_at >= my_since
    and not exists (select 1 from taunt_mutes m where m.user_id = uid and m.muted_id = t.sender_id)
  order by t.sent_at desc;
end;
$function$;

revoke all on function public.my_taunts_received_today() from public, anon;
grant execute on function public.my_taunts_received_today() to authenticated;

-- ---------------------------------------------------------------------------
-- answer_taunts_on_post(): same target-local day, not a 3 h window.
-- ---------------------------------------------------------------------------
create or replace function public.answer_taunts_on_post()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t record;
  target_tz text;
  target_since timestamptz;
begin
  select coalesce(nullif(timezone, ''), 'UTC') into target_tz from profiles where id = new.user_id;
  target_tz := coalesce(target_tz, 'UTC');
  target_since := date_trunc('day', now() at time zone target_tz) at time zone target_tz;

  for t in
    select id, sender_id from taunts
    where target_id = new.user_id
      and answered_post_id is null
      and sent_at >= target_since
  loop
    update taunts set answered_post_id = new.id where id = t.id;
    -- Gate handles blocks/restricts; dedupe on the taunt so a second post the
    -- same day can't re-notify.
    perform dispatch_notification(
      t.sender_id, new.user_id, 'taunt_answered',
      'taunt_answered:' || t.id::text,
      jsonb_build_object('post_id', new.id, 'taunt_id', t.id)
    );
  end loop;
  return new;
exception when others then
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- send_taunt_line(): rest-day + quiet-window guards.
-- ---------------------------------------------------------------------------
create or replace function public.send_taunt_line(p_target uuid, p_line_id text, p_line_text text, p_since timestamptz)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  sender_tz text;
  target_tz text;
  sender_since timestamptz;
  target_since timestamptz;
  target_day date;
  target_hour int;
  taunt_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_target = uid then raise exception 'cannot_taunt_self'; end if;
  if not are_friends(uid, p_target) then raise exception 'not_friends'; end if;

  select coalesce(nullif(timezone, ''), 'UTC') into sender_tz from profiles where id = uid;
  select coalesce(nullif(timezone, ''), 'UTC') into target_tz from profiles where id = p_target;
  sender_tz := coalesce(sender_tz, 'UTC');
  target_tz := coalesce(target_tz, 'UTC');
  sender_since := date_trunc('day', now() at time zone sender_tz) at time zone sender_tz;
  target_since := date_trunc('day', now() at time zone target_tz) at time zone target_tz;
  target_day := (now() at time zone target_tz)::date;
  target_hour := extract(hour from now() at time zone target_tz)::int;

  if not exists (select 1 from posts where user_id = uid and created_at >= sender_since) then
    raise exception 'sender_not_posted';
  end if;
  if exists (select 1 from posts where user_id = p_target and created_at >= target_since)
     or exists (select 1 from gym_days where user_id = p_target and day = target_day and kind = 'gym') then
    raise exception 'target_already_posted';
  end if;
  -- A declared rest day is an answer, not an absence.
  if exists (select 1 from gym_days where user_id = p_target and day = target_day and kind = 'rest') then
    raise exception 'target_rest_day';
  end if;
  -- 07:00–21:59 target-local only.
  if target_hour < 7 or target_hour >= 22 then
    raise exception 'target_quiet_hours';
  end if;
  if (select count(*) from taunts where sender_id = uid and sent_at >= sender_since) >= 15 then
    raise exception 'daily_send_limit';
  end if;
  if exists (select 1 from taunts where sender_id = uid and target_id = p_target and sent_at >= sender_since) then
    raise exception 'already_taunted_target';
  end if;

  insert into taunts (sender_id, target_id, line_id) values (uid, p_target, p_line_id)
  returning id into taunt_id;

  -- Per-friend mute: recipient silenced this sender's taunts.
  if not exists (select 1 from taunt_mutes where user_id = p_target and muted_id = uid) then
    -- Gate dedupes 1 sender->recipient per day (spec).
    perform dispatch_notification(
      p_target, uid, 'taunt',
      'taunt:' || p_target::text || ':' || uid::text || ':' || target_day::text,
      jsonb_build_object('text', left(p_line_text, 140), 'taunt_id', taunt_id)
    );
  end if;
  return taunt_id;
end $function$;

grant execute on function public.send_taunt_line(uuid, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- daily_nudge off. 611 sent, 1 % opened; the taunt loop replaces it. The
-- function stays (re-schedule with cron.schedule('daily-nudge', ...) if the
-- conditional version in Release C wants it back).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'daily-nudge') then
    perform cron.unschedule('daily-nudge');
  end if;
end $$;
