-- The single gate. Every push-worthy notification calls dispatch_notification;
-- it enforces the per-type toggle, block relationship (both directions), quiet
-- hours (recipient timezone), and dedupe/rate-limit via the unique index —
-- then inserts the notifications row (whose trigger fans out to send-push).
create or replace function public.notification_prefs(p_user uuid)
returns public.notification_preferences
language plpgsql security definer set search_path = public as $$
declare v_prefs public.notification_preferences;
begin
  select * into v_prefs from notification_preferences where user_id = p_user;
  if v_prefs.user_id is null then
    insert into notification_preferences (user_id) values (p_user) on conflict (user_id) do nothing;
    select * into v_prefs from notification_preferences where user_id = p_user;
  end if;
  return v_prefs;
end; $$;

create or replace function public.is_quiet_hours(p_prefs public.notification_preferences)
returns boolean language sql immutable as $$
  with t as (select (now() at time zone coalesce(nullif(p_prefs.timezone, ''), 'UTC'))::time as local_time)
  select case
    when p_prefs.quiet_hours_start <= p_prefs.quiet_hours_end then
      (select local_time between p_prefs.quiet_hours_start and p_prefs.quiet_hours_end from t)
    else (select local_time >= p_prefs.quiet_hours_start or local_time < p_prefs.quiet_hours_end from t)
  end;
$$;

create or replace function public.dispatch_notification(
  p_recipient uuid, p_actor uuid, p_type public.notification_type,
  p_dedupe_key text, p_payload jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_prefs public.notification_preferences; v_enabled boolean; v_is_system boolean;
begin
  if p_recipient is null then return false; end if;
  if p_actor = p_recipient then return false; end if;
  if p_actor is not null and exists (
    select 1 from user_blocks b
    where (b.blocker_id = p_recipient and b.blocked_id = p_actor)
       or (b.blocker_id = p_actor and b.blocked_id = p_recipient)
  ) then return false; end if;
  v_prefs := notification_prefs(p_recipient);
  v_enabled := case p_type
    when 'arrival_buzz' then v_prefs.gym_reminders_enabled
    when 'daily_nudge' then v_prefs.gym_reminders_enabled
    when 'taunt' then v_prefs.taunts_enabled
    when 'gym_arrival_friend' then v_prefs.friend_checkins_scope <> 'off'
    when 'dm' then v_prefs.messages_enabled
    when 'friend_request' then v_prefs.friend_requests_enabled
    when 'post_reaction' then v_prefs.reactions_enabled
    else true
  end;
  if not v_enabled then return false; end if;
  v_is_system := p_type in ('arrival_buzz', 'daily_nudge');
  begin
    insert into notification_log (user_id, type, dedupe_key) values (p_recipient, p_type::text, p_dedupe_key);
  exception when unique_violation then return false;
  end;
  if v_is_system and is_quiet_hours(v_prefs) then return false; end if;
  insert into notifications (recipient_id, actor_id, type, payload)
  values (p_recipient, p_actor, p_type, coalesce(p_payload, '{}'::jsonb));
  return true;
end; $$;

revoke all on function public.dispatch_notification(uuid, uuid, public.notification_type, text, jsonb) from public, anon;
grant execute on function public.dispatch_notification(uuid, uuid, public.notification_type, text, jsonb) to authenticated, service_role;
