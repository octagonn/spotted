-- Reroute notification producers through the enforcement gate + daily-nudge
-- cron (spec 1B).

-- DM: gate enforces messages_enabled + blocks; dedupe per message id.
create or replace function public.notify_dm()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  conv conversations%rowtype;
  recipient uuid;
  muted_thread boolean;
  preview_ok boolean;
  payload jsonb;
begin
  select * into conv from conversations where id = new.conversation_id;
  if conv.id is null then return new; end if;
  recipient := case when new.sender_id = conv.participant_a then conv.participant_b else conv.participant_a end;
  if recipient is null then return new; end if;
  select coalesce(muted, false) into muted_thread
    from conversation_participants where conversation_id = new.conversation_id and user_id = recipient;
  if muted_thread then return new; end if;
  select coalesce(dm_preview_enabled, true) into preview_ok from profiles where id = recipient;
  payload := case
    when preview_ok and new.content is not null
      then jsonb_build_object('messagePreview', left(new.content, 140), 'conversation_id', new.conversation_id::text)
    else jsonb_build_object('conversation_id', new.conversation_id::text)
  end;
  perform dispatch_notification(recipient, new.sender_id, 'dm', 'dm:' || new.id::text, payload);
  return new;
exception when others then return new;
end $$;

-- Friend gym check-in: bundle per 30-min window per recipient; scope
-- (my_gym/all_friends/off) enforced; my_gym requires the recipient to have
-- checked into this gym before.
create or replace function public.notify_gym_arrival()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_window text;
  v_scope public.friend_checkins_scope;
  v_seen_gym boolean;
begin
  v_window := to_char(date_trunc('hour', now()) + (floor(extract(minute from now())/30) * interval '30 min'), 'YYYYMMDDHH24MI');
  for r in
    select case when f.user_id = new.user_id then f.friend_id else f.user_id end as recipient_id
    from friendships f
    where f.status = 'accepted' and new.user_id in (f.user_id, f.friend_id)
  loop
    select friend_checkins_scope into v_scope from notification_prefs(r.recipient_id);
    if v_scope = 'off' then continue; end if;
    if v_scope = 'my_gym' then
      select exists(select 1 from checkins ci where ci.user_id = r.recipient_id and ci.gym_id = new.gym_id)
        into v_seen_gym;
      if not v_seen_gym then continue; end if;
    end if;
    perform dispatch_notification(
      r.recipient_id, new.user_id, 'gym_arrival_friend',
      'friend_checkin:' || r.recipient_id::text || ':' || v_window,
      jsonb_build_object('gym_id', new.gym_id, 'checkin_id', new.id)
    );
  end loop;
  return new;
exception when others then return new;
end $$;

-- Daily nudge (1B): every 15 min, users at their local nudge time who haven't
-- posted today. Streak-state copy.
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
    select coalesce(s.current_streak, 0) into v_streak from streaks s where s.user_id = r.user_id;
    v_broke_yesterday := exists (
      select 1 from streaks s
      where s.user_id = r.user_id
        and coalesce(s.current_streak, 0) = 0
        and s.last_checkin_date = v_local - 2
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

do $$ begin perform cron.unschedule('daily-nudge'); exception when others then null; end $$;
select cron.schedule('daily-nudge', '*/15 * * * *', 'select public.daily_nudge_sweep()');
