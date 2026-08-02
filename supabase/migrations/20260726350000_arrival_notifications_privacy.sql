-- Make the existing arrival_buzz type real and ensure friend arrival pushes
-- obey the check-in audience/quiet flags before any activity is created.

create or replace function public.notify_gym_arrival()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_window text;
  v_scope public.friend_checkins_scope;
begin
  -- Confirmation for the person who was just checked in. The Expo push gate
  -- applies gym_reminders_enabled and quiet hours; the inbox hides this system
  -- event so it never becomes stale social activity.
  perform dispatch_notification(
    new.user_id,
    null,
    'arrival_buzz',
    'arrival_buzz:' || new.id::text,
    jsonb_build_object(
      'gym_id', new.gym_id,
      'checkin_id', new.id,
      'text', 'Checked in. Time to get to work.'
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
$$;

