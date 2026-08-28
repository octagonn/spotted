-- Tone pass: grabby but friendly (no "dead", "kills", "you didn't"), and six
-- rotating variants per state so nobody sees the same nudge twice in a week.
-- Both functions emit a `title` in the payload; send-push prefers it.

create or replace function public.daily_nudge_sweep()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_tz text;
  v_local date;
  v_streak integer;
  v_broke_yesterday boolean;
  v_friends integer;
  v_pick integer;
  v_title text;
  v_text text;
  v_friends_line text;
  v_sent integer := 0;
begin
  for r in
    select np.user_id, np.timezone, np.daily_nudge_time
    from notification_preferences np
    where np.gym_reminders_enabled = true
  loop
    v_tz := coalesce(nullif(r.timezone, ''), 'UTC');
    if (now() at time zone v_tz)::time
         not between r.daily_nudge_time and r.daily_nudge_time + interval '15 min' then
      continue;
    end if;
    v_local := (now() at time zone v_tz)::date;
    if exists (select 1 from posts p where p.user_id = r.user_id
                 and (p.created_at at time zone v_tz)::date = v_local) then
      continue;
    end if;
    if exists (select 1 from gym_days g
                 where g.user_id = r.user_id and g.day = v_local and g.kind = 'rest') then
      continue;
    end if;

    v_streak := gym_streak_count(r.user_id, r.timezone);
    v_broke_yesterday := v_streak = 0 and exists (
      select 1 from gym_days g
      where g.user_id = r.user_id and g.day = v_local - 2 and g.kind = 'gym'
    );
    select count(distinct p.user_id) into v_friends
    from posts p
    join friendships f on f.status = 'accepted'
      and ((f.user_id = r.user_id and f.friend_id = p.user_id)
        or (f.friend_id = r.user_id and f.user_id = p.user_id))
    where (p.created_at at time zone v_tz)::date = v_local;
    v_friends_line := v_friends || case when v_friends = 1 then ' friend' else ' friends' end;
    -- Stable per user per day, rotates day to day.
    v_pick := abs(hashtext(r.user_id::text || v_local::text)) % 6;

    if v_broke_yesterday then
      v_title := case v_pick
        when 0 then 'Fresh start today'
        when 1 then 'New streak starts now'
        when 2 then 'Yesterday''s gone. Today counts.'
        when 3 then 'Day 1 is waiting'
        when 4 then 'Back at it?'
        else 'Streak reset. No big deal.' end;
      v_text := case v_pick
        when 0 then 'Post today and Day 1 is in the books.'
        when 1 then 'Everyone slips. Get back on it.'
        when 2 then 'One post and you''re rolling again.'
        when 3 then 'The first day back is the one that matters.'
        when 4 then case when v_friends > 0 then v_friends_line || ' posted today. Join them.' else 'Post your SPOTTED and start over strong.' end
        else 'Show up today. That''s the whole plan.' end;
    elsif coalesce(v_streak, 0) > 0 then
      v_title := case v_pick
        when 0 then v_streak || '-day streak on the line'
        when 1 then 'Keep the streak alive'
        when 2 then 'Day ' || (v_streak + 1) || ' is waiting'
        when 3 then v_streak || ' days strong. Make it ' || (v_streak + 1) || '.'
        when 4 then 'Your streak wants day ' || (v_streak + 1)
        else 'Still time to keep it going' end;
      v_text := case v_pick
        when 0 then 'Post today''s SPOTTED before midnight.'
        when 1 then case when v_friends > 0 then v_friends_line || ' already posted today. Join them.' else 'One post keeps it going.' end
        when 2 then 'Quick post, streak safe.'
        when 3 then 'Show up, snap it, done.'
        when 4 then 'One post before midnight does it.'
        else case when v_friends > 0 then v_friends_line || ' posted today. Your turn.' else 'Don''t let today slip by.' end end;
    else
      v_title := case v_pick
        when 0 then case when v_friends > 0 then v_friends_line || ' posted today' else 'Today''s a good day to post' end
        when 1 then 'Your feed''s locked'
        when 2 then 'Haven''t seen you today'
        when 3 then 'Start a streak today'
        when 4 then case when v_friends > 0 then 'Your crew''s been busy' else 'Day 1 is the easiest to start' end
        else 'Get Spotted today' end;
      v_text := case v_pick
        when 0 then 'See what they did. Post your SPOTTED.'
        when 1 then 'One post unlocks everything.'
        when 2 then 'Post today and it counts.'
        when 3 then 'Day 1 starts with one post.'
        when 4 then case when v_friends > 0 then v_friends_line || ' posted. Go see it after you post yours.' else 'Snap one at the gym and you''re in.' end
        else 'Show up. Get Spotted.' end;
    end if;

    if dispatch_notification(r.user_id, null, 'daily_nudge',
         'daily_nudge:' || v_local::text,
         jsonb_build_object('title', v_title, 'text', v_text, 'route', '/(tabs)/feed')) then
      v_sent := v_sent + 1;
    end if;
  end loop;
  return v_sent;
end $function$;

create or replace function public.notify_gym_arrival()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_window text;
  v_scope public.friend_checkins_scope;
  v_pick integer;
begin
  -- Confirmation for the person who was just checked in. The Expo push gate
  -- applies gym_reminders_enabled and quiet hours; the inbox hides this system
  -- event so it never becomes stale social activity.
  v_pick := abs(hashtext(new.id::text)) % 6;
  perform dispatch_notification(
    new.user_id,
    null,
    'arrival_buzz',
    'arrival_buzz:' || new.id::text,
    jsonb_build_object(
      'gym_id', new.gym_id,
      'checkin_id', new.id,
      'title', case v_pick
        when 0 then 'You made it in'
        when 1 then 'Checked in. Nice.'
        when 2 then 'You''re at the gym'
        when 3 then 'Gym time'
        when 4 then 'Showed up. That''s the hard part.'
        else 'You''re in' end,
      'text', case v_pick
        when 0 then 'Get after it, then post your SPOTTED before you leave.'
        when 1 then 'Post your SPOTTED before you head out.'
        when 2 then 'Snap your SPOTTED once you''re warmed up.'
        when 3 then 'Get to work. Post it when you''re done.'
        when 4 then 'Lock it in with a post before you go.'
        else 'Your crew will see it. Make it count.' end
    )
  );

  -- Quiet/nobody check-ins are intentionally invisible to friends.
  if coalesce(new.is_quiet, false) or coalesce(new.audience, 'friends') = 'nobody' then
    return new;
  end if;

  v_window := to_char(
    date_trunc('hour', now())
      + (floor(extract(minute from now()) / 30) * interval '30 min'),
    'YYYYMMDDHH24MI'
  );

  for r in
    select case when f.user_id = new.user_id then f.friend_id else f.user_id end as recipient_id
    from friendships f
    where f.status = 'accepted'
      and new.user_id in (f.user_id, f.friend_id)
  loop
    if new.audience = 'close_friends' and not exists (
      select 1
      from close_friends cf
      where cf.user_id = new.user_id
        and cf.friend_id = r.recipient_id
    ) then
      continue;
    end if;

    select friend_checkins_scope
    into v_scope
    from notification_prefs(r.recipient_id);

    if v_scope = 'off' then
      continue;
    end if;
    if v_scope = 'my_gym' and not exists (
      select 1
      from profiles p
      where p.id = r.recipient_id
        and p.home_gym_id = new.gym_id
    ) then
      continue;
    end if;

    perform dispatch_notification(
      r.recipient_id,
      new.user_id,
      'gym_arrival_friend',
      'friend_checkin:' || r.recipient_id::text || ':' || v_window,
      jsonb_build_object('gym_id', new.gym_id, 'checkin_id', new.id)
    );
  end loop;
  return new;
exception when others then
  -- Presence writes must still succeed if notification fan-out fails.
  return new;
end;
$function$;
