-- Privacy audit: "Restricted accounts" promised a quiet mute but gated
-- nothing — restrict/unrestrict RPCs and the list screen worked, yet a
-- restricted user's likes/comments/DM pushes still notified. Enforce it at
-- the single dispatch gate: if the recipient restricted the actor, no
-- notification (in-app or push) is created. The restricted user is never
-- told; their messages still land in the thread, just silently.
create or replace function public.dispatch_notification(p_recipient uuid, p_actor uuid, p_type notification_type, p_dedupe_key text, p_payload jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_log_id uuid;
  v_notification_id uuid;
begin
  if p_recipient is null then return false; end if;
  if p_actor = p_recipient then return false; end if;

  if p_actor is not null and exists (
    select 1 from user_blocks b
    where (b.blocker_id = p_recipient and b.blocked_id = p_actor)
       or (b.blocker_id = p_actor and b.blocked_id = p_recipient)
  ) then
    return false;
  end if;

  -- Quiet mute: the recipient restricted this actor.
  if p_actor is not null and is_restricted(p_recipient, p_actor) then
    return false;
  end if;

  begin
    insert into notification_log (user_id, type, dedupe_key)
    values (p_recipient, p_type::text, p_dedupe_key)
    returning id into v_log_id;
  exception when unique_violation then
    return false;
  end;

  insert into notifications (recipient_id, actor_id, type, payload)
  values (p_recipient, p_actor, p_type, coalesce(p_payload, '{}'::jsonb))
  returning id into v_notification_id;

  update notification_log
  set notification_id = v_notification_id
  where id = v_log_id;

  return true;
end;
$function$;
