-- ============================================================================
-- Analytics v2: session context on events, an internal `analytics` schema of
-- views + durable daily rollups for the future metrics tool, and a
-- consent-independent activity ledger (DAU/retention for ALL users; the
-- consented event stream stays the deep-behavior source).
-- ============================================================================

-- ---------- 1. Event context columns ----------
alter table public.analytics_events
  add column if not exists session_id uuid,
  add column if not exists app_version text,
  add column if not exists platform text,
  add column if not exists os_version text;

create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id, occurred_at)
  where session_id is not null;
create index if not exists analytics_events_props_gin
  on public.analytics_events using gin (properties jsonb_path_ops);

-- ---------- 2. Activity ledger (all users, backend-only) ----------
alter table public.user_activity
  add column if not exists first_active_at timestamptz,
  add column if not exists last_active_at timestamptz,
  add column if not exists active_days integer not null default 0,
  add column if not exists sessions_count integer not null default 0,
  add column if not exists last_app_version text,
  add column if not exists last_platform text;

create table if not exists public.user_activity_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  sessions integer not null default 1,
  primary key (user_id, day)
);
alter table public.user_activity_days enable row level security;
create index if not exists user_activity_days_day_idx on public.user_activity_days (day);

create or replace function public.touch_user_activity(p_app_version text default null, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_uid is null then return; end if;
  insert into user_activity (user_id, first_active_at, last_active_at, active_days, sessions_count, last_app_version, last_platform)
  values (v_uid, now(), now(), 1, 1, left(p_app_version, 32), left(p_platform, 16))
  on conflict (user_id) do update set
    first_active_at = coalesce(user_activity.first_active_at, now()),
    active_days = user_activity.active_days
      + case when user_activity.last_active_at is null
                or (user_activity.last_active_at at time zone 'utc')::date < v_today then 1 else 0 end,
    sessions_count = user_activity.sessions_count + 1,
    last_active_at = now(),
    last_app_version = coalesce(left(p_app_version, 32), user_activity.last_app_version),
    last_platform = coalesce(left(p_platform, 16), user_activity.last_platform),
    updated_at = now();
  insert into user_activity_days (user_id, day)
  values (v_uid, v_today)
  on conflict (user_id, day) do update set sessions = user_activity_days.sessions + 1;
end $$;
grant execute on function public.touch_user_activity(text, text) to authenticated;

-- ---------- 3. Internal analytics schema (NOT exposed through the API) ----------
create schema if not exists analytics;
revoke all on schema analytics from anon, authenticated;

create table if not exists analytics.daily_events (
  day date not null,
  event_name text not null,
  events integer not null,
  users integer not null,
  primary key (day, event_name)
);
create table if not exists analytics.daily_summary (
  day date primary key,
  tracked_users integer not null default 0,
  sessions integer not null default 0,
  avg_session_sec integer,
  median_session_sec integer,
  screens_per_session numeric(6,2),
  events integer not null default 0,
  active_users integer not null default 0,
  new_users integer not null default 0,
  posts integer not null default 0,
  workouts integer not null default 0,
  messages integer not null default 0,
  friend_requests integer not null default 0
);
create table if not exists analytics.daily_screens (
  day date not null,
  screen text not null,
  views integer not null,
  users integer not null,
  avg_dwell_ms integer,
  primary key (day, screen)
);

create or replace view analytics.sessions as
select
  session_id,
  user_id,
  min(occurred_at) as started_at,
  max(occurred_at) as ended_at,
  extract(epoch from max(occurred_at) - min(occurred_at))::int as duration_sec,
  count(*) filter (where event_name = 'screen_view') as screens,
  count(*) as events,
  max(app_version) as app_version,
  max(platform) as platform,
  max(os_version) as os_version
from public.analytics_events
where session_id is not null
group by session_id, user_id;

create or replace view analytics.events_daily as
select (occurred_at at time zone 'utc')::date as day, event_name,
       count(*) as events, count(distinct user_id) as users
from public.analytics_events
group by 1, 2;

create or replace view analytics.screens_daily as
select (occurred_at at time zone 'utc')::date as day,
       properties->>'screen' as screen,
       count(*) as views,
       count(distinct user_id) as users
from public.analytics_events
where event_name = 'screen_view'
group by 1, 2;

create or replace view analytics.weekly_retention as
with cohort as (
  select id as user_id, date_trunc('week', created_at)::date as cohort_week from public.profiles
),
active as (
  select distinct user_id, date_trunc('week', day)::date as active_week from public.user_activity_days
)
select c.cohort_week,
       ((a.active_week - c.cohort_week) / 7)::int as week_n,
       count(distinct a.user_id) as users,
       (select count(*) from cohort c2 where c2.cohort_week = c.cohort_week) as cohort_size
from cohort c
join active a on a.user_id = c.user_id
group by 1, 2;

create or replace view analytics.daily_post_funnel as
select day,
  count(distinct user_id) filter (where event_name = 'app_open') as opened,
  count(distinct user_id) filter (where event_name = 'camera_open') as camera,
  count(distinct user_id) filter (where event_name = 'photo_captured') as captured,
  count(distinct user_id) filter (where event_name in ('daily_post_published','daily_post_queued_offline')) as published
from (select (occurred_at at time zone 'utc')::date as day, user_id, event_name from public.analytics_events) e
group by day;

create or replace view analytics.user_overview as
select p.id as user_id, p.username, p.created_at as signed_up_at,
       ua.last_login_at, ua.first_active_at, ua.last_active_at, ua.active_days, ua.sessions_count,
       ua.last_app_version, ua.last_platform,
       coalesce(ap.product_analytics_enabled, false) as analytics_consented,
       (select count(*) from public.posts po where po.user_id = p.id) as posts,
       (select count(*) from public.workouts w where w.user_id = p.id) as workouts,
       (select count(*) from public.friendships f where f.status = 'accepted' and (f.user_id = p.id or f.friend_id = p.id)) as friends,
       (select count(*) from public.messages m where m.sender_id = p.id) as messages_sent,
       (select count(*) from public.profile_views pv where pv.profile_id = p.id) as profile_views_received,
       (select coalesce(sum(view_count), 0) from public.post_views v join public.posts po on po.id = v.post_id where po.user_id = p.id) as post_views_received
from public.profiles p
left join public.user_activity ua on ua.user_id = p.id
left join public.analytics_preferences ap on ap.user_id = p.id;

-- ---------- 4. Daily rollup (runs before the 04:17 retention delete) ----------
create or replace function analytics.rollup_day(p_day date)
returns void
language plpgsql
security definer
set search_path = public, analytics
as $$
begin
  insert into analytics.daily_events (day, event_name, events, users)
  select p_day, event_name, count(*), count(distinct user_id)
  from public.analytics_events
  where (occurred_at at time zone 'utc')::date = p_day
  group by event_name
  on conflict (day, event_name) do update set events = excluded.events, users = excluded.users;

  insert into analytics.daily_screens (day, screen, views, users, avg_dwell_ms)
  select p_day, properties->>'screen', count(*), count(distinct user_id),
         avg((properties->>'dwell_ms')::numeric)::int
  from public.analytics_events
  where event_name = 'screen_view' and (occurred_at at time zone 'utc')::date = p_day
  group by properties->>'screen'
  on conflict (day, screen) do update
    set views = excluded.views, users = excluded.users, avg_dwell_ms = excluded.avg_dwell_ms;

  insert into analytics.daily_summary (day, tracked_users, sessions, avg_session_sec, median_session_sec,
                                       screens_per_session, events, active_users, new_users, posts, workouts,
                                       messages, friend_requests)
  select p_day,
    (select count(distinct user_id) from public.analytics_events where (occurred_at at time zone 'utc')::date = p_day),
    (select count(*) from analytics.sessions where (started_at at time zone 'utc')::date = p_day),
    (select avg(duration_sec)::int from analytics.sessions where (started_at at time zone 'utc')::date = p_day),
    (select percentile_cont(0.5) within group (order by duration_sec)::int from analytics.sessions where (started_at at time zone 'utc')::date = p_day),
    (select avg(screens)::numeric(6,2) from analytics.sessions where (started_at at time zone 'utc')::date = p_day),
    (select count(*) from public.analytics_events where (occurred_at at time zone 'utc')::date = p_day),
    (select count(*) from public.user_activity_days where day = p_day),
    (select count(*) from public.profiles where (created_at at time zone 'utc')::date = p_day),
    (select count(*) from public.posts where (created_at at time zone 'utc')::date = p_day),
    (select count(*) from public.workouts where (started_at at time zone 'utc')::date = p_day),
    (select count(*) from public.messages where (sent_at at time zone 'utc')::date = p_day),
    (select count(*) from public.friendships where (created_at at time zone 'utc')::date = p_day)
  on conflict (day) do update set
    tracked_users = excluded.tracked_users, sessions = excluded.sessions,
    avg_session_sec = excluded.avg_session_sec, median_session_sec = excluded.median_session_sec,
    screens_per_session = excluded.screens_per_session, events = excluded.events,
    active_users = excluded.active_users, new_users = excluded.new_users, posts = excluded.posts,
    workouts = excluded.workouts, messages = excluded.messages, friend_requests = excluded.friend_requests;
end $$;

select cron.unschedule('analytics-daily-rollup') where exists (select 1 from cron.job where jobname = 'analytics-daily-rollup');
select cron.schedule('analytics-daily-rollup', '0 4 * * *',
  $$select analytics.rollup_day(((now() at time zone 'utc')::date - 1))$$);

do $$
declare d date;
begin
  for d in select distinct (occurred_at at time zone 'utc')::date from public.analytics_events order by 1 loop
    perform analytics.rollup_day(d);
  end loop;
end $$;
