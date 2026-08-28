-- Communities hub v1 gaps: the gym-scoped Board, and group-chat pushes.

-- ---------- Board ----------
-- Streaks and check-in counts scoped to THIS gym only (spec Part 3), for
-- every member, computed from check-ins in each member's own timezone.
-- Membership-gated: non-members get {locked:true} and no rows, no matter how
-- the screen was reached.
create or replace function public.community_board(p_community_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_gym uuid;
  v_rows jsonb;
begin
  if v_uid is null
     or not exists (select 1 from community_members where community_id = p_community_id and user_id = v_uid) then
    return jsonb_build_object('locked', true, 'rows', '[]'::jsonb);
  end if;
  select gym_id into v_gym from communities where id = p_community_id;
  if v_gym is null then
    return jsonb_build_object('rows', '[]'::jsonb);
  end if;

  with members as (
    select m.user_id, coalesce(nullif(p.timezone, ''), 'UTC') as tz,
           p.display_name, p.username, p.avatar_url, m.joined_at
    from community_members m
    join profiles p on p.id = m.user_id
    where m.community_id = p_community_id
  ),
  today as (
    select user_id, (now() at time zone tz)::date as t from members
  ),
  days as (
    -- one row per member per local day with at least one check-in at this gym
    select c.user_id, (c.checked_in_at at time zone mm.tz)::date as d
    from checkins c
    join members mm on mm.user_id = c.user_id
    where c.gym_id = v_gym
      and c.checked_in_at > now() - interval '400 days'
    group by 1, 2
  ),
  islands as (
    select user_id, d, d - (row_number() over (partition by user_id order by d))::int as grp from days
  ),
  runs as (
    select user_id, grp, count(*)::int as len, max(d) as last_day from islands group by 1, 2
  ),
  streaks as (
    -- the run that reaches today or yesterday (grace for "haven't gone yet today")
    select r.user_id, r.len as streak, r.last_day
    from runs r join today t on t.user_id = r.user_id
    where r.last_day >= t.t - 1
  ),
  month as (
    select d.user_id, count(*)::int as month_days
    from days d join today t on t.user_id = d.user_id
    where date_trunc('month', d.d) = date_trunc('month', t.t)
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', m.user_id,
           'name', m.display_name,
           'username', m.username,
           'avatar_url', m.avatar_url,
           'joined_at', m.joined_at,
           'streak', coalesce(s.streak, 0),
           'month_days', coalesce(mo.month_days, 0),
           'last_day', s.last_day
         ) order by coalesce(s.streak, 0) desc, coalesce(mo.month_days, 0) desc, m.display_name), '[]'::jsonb)
  into v_rows
  from members m
  left join streaks s on s.user_id = m.user_id
  left join month mo on mo.user_id = m.user_id;

  return jsonb_build_object('rows', v_rows);
end $$;
grant execute on function public.community_board(uuid) to authenticated;

-- ---------- Group-chat pushes ----------
-- One notification per member per community per 10-minute window (a 40-person
-- chat must not fire a push per message). Muted members are skipped here, so
-- mute silences both the push and the inbox. send-push additionally applies
-- the DM preference + quiet hours.
create or replace function public.notify_community_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_name text;
  v_window text;
  v_preview text;
begin
  select name into v_name from communities where id = new.community_id;
  v_window := to_char(
    date_trunc('hour', now()) + (floor(extract(minute from now()) / 10) * interval '10 min'),
    'YYYYMMDDHH24MI'
  );
  v_preview := left(coalesce(new.content, ''), 90);
  for r in
    select m.user_id
    from community_members m
    where m.community_id = new.community_id
      and m.user_id <> new.sender_id
      and coalesce(m.muted, false) = false
  loop
    perform dispatch_notification(
      r.user_id,
      new.sender_id,
      'community_message',
      'community_msg:' || new.community_id::text || ':' || r.user_id::text || ':' || v_window,
      jsonb_build_object(
        'community_id', new.community_id,
        'community_name', v_name,
        'text', v_preview,
        'message_id', new.id
      )
    );
  end loop;
  return new;
exception when others then
  -- Sending a message must never fail because notification fan-out did.
  return new;
end $$;

drop trigger if exists community_messages_notify on public.community_messages;
create trigger community_messages_notify
  after insert on public.community_messages
  for each row execute function public.notify_community_message();
