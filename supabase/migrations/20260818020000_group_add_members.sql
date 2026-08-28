-- Add people to an existing group chat: any member may add their own friends
-- (same trust rule as creation), total capped at 16 including existing.
create or replace function public.add_group_members(p_conversation uuid, p_member_ids uuid[])
returns void language plpgsql security definer set search_path = public as $function$
declare
  uid uuid := auth.uid();
  conv conversations%rowtype;
  member uuid;
  current_count int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into conv from conversations where id = p_conversation;
  if conv.id is null or not conv.is_group then raise exception 'not_a_group'; end if;
  if not public.is_conversation_member(p_conversation, uid) then raise exception 'not_member'; end if;
  if p_member_ids is null or coalesce(array_length(p_member_ids, 1), 0) < 1 then
    raise exception 'members_required';
  end if;
  foreach member in array p_member_ids loop
    if member = uid then continue; end if;
    if not public.are_friends(uid, member) then raise exception 'members_must_be_friends'; end if;
    if public.is_blocked(uid, member) then raise exception 'blocked'; end if;
  end loop;
  select count(*) into current_count from conversation_participants where conversation_id = p_conversation;
  if current_count + array_length(p_member_ids, 1) > 16 then raise exception 'too_many_members'; end if;
  insert into conversation_participants (conversation_id, user_id)
  select p_conversation, m from unnest(p_member_ids) as m
  on conflict do nothing;
end $function$;
