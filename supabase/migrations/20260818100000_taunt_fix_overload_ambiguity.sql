-- The relaxed-rules migration (20260818090000) recreated send_taunt_line with
-- p_line_id INTEGER, which ADDED an overload next to the original TEXT version
-- instead of replacing it. Client line ids are text slugs ("couch", "alarm"),
-- so calls kept hitting the old strict function (5/day cap + 9pm quiet hours)
-- or failed on overload ambiguity — testers saw "Taunted" flip back to "Taunt".
-- Collapse to a single TEXT function carrying the relaxed rules.
drop function if exists public.send_taunt_line(uuid, integer, text, timestamptz);
drop function if exists public.send_taunt_line(uuid, text, text, timestamptz);

create function public.send_taunt_line(p_target uuid, p_line_id text, p_line_text text, p_since timestamptz)
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
  taunt_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_target = uid then raise exception 'cannot_taunt_self'; end if;
  if not are_friends(uid, p_target) then raise exception 'not_friends'; end if;

  select timezone into sender_tz from profiles where id = uid;
  select timezone into target_tz from profiles where id = p_target;
  sender_since := date_trunc('day', now() at time zone coalesce(nullif(sender_tz, ''), 'UTC'))
                  at time zone coalesce(nullif(sender_tz, ''), 'UTC');
  target_since := date_trunc('day', now() at time zone coalesce(nullif(target_tz, ''), 'UTC'))
                  at time zone coalesce(nullif(target_tz, ''), 'UTC');

  if not exists (select 1 from posts where user_id = uid and created_at >= sender_since) then
    raise exception 'sender_not_posted';
  end if;
  if exists (select 1 from posts where user_id = p_target and created_at >= target_since) then
    raise exception 'target_already_posted';
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
      'taunt:' || p_target::text || ':' || uid::text || ':' || (now() at time zone coalesce(nullif(target_tz,''),'UTC'))::date::text,
      jsonb_build_object('text', left(p_line_text, 140), 'taunt_id', taunt_id)
    );
  end if;
  return taunt_id;
end $function$;

grant execute on function public.send_taunt_line(uuid, text, text, timestamptz) to authenticated;
