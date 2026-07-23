-- Rotating nudge lines: the client sends one of 20 canned pokes; the line
-- rides in the notification payload as `text`. Old callers (no text) keep
-- working via the default.
drop function if exists public.nudge_community(uuid);
create or replace function public.nudge_community(cid uuid, p_text text default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  cname text;
  notified integer := 0;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from community_members where community_id = cid and user_id = uid
  ) then
    raise exception 'not_a_member';
  end if;
  if exists (
    select 1 from community_nudges
    where community_id = cid and user_id = uid
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'nudge_rate_limited';
  end if;

  select name into cname from communities where id = cid;
  insert into community_nudges (community_id, user_id) values (cid, uid);

  with quiet_members as (
    select m.user_id
    from community_members m
    where m.community_id = cid
      and m.user_id <> uid
      and not exists (
        select 1 from community_messages msg
        where msg.community_id = cid
          and msg.sender_id = m.user_id
          and msg.sent_at > now() - interval '3 days'
      )
  )
  insert into notifications (recipient_id, actor_id, type, payload)
  select q.user_id, uid, 'community_nudge',
         jsonb_build_object('communityId', cid, 'communityName', cname, 'text', left(coalesce(p_text, ''), 140))
  from quiet_members q;
  get diagnostics notified = row_count;
  return notified;
end;
$$;

revoke all on function public.nudge_community(uuid, text) from public;
grant execute on function public.nudge_community(uuid, text) to authenticated;
