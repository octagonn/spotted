-- Unnamed groups used to bake the CREATOR's auto-name ("Ethan & Mason") into
-- the title, so every member saw the creator's perspective. Now a blank name
-- stores NULL and each client renders the OTHER members' names per viewer;
-- pushes compute the same per recipient.

-- 1) Groups may be created without a title.
create or replace function public.conversations_gatekeeper()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if new.is_group then
    return new; -- title optional; friendship/blocks validated by create_group_conversation
  end if;
  if exists (
    select 1 from user_blocks
    where (blocker_id = new.participant_a and blocked_id = new.participant_b)
       or (blocker_id = new.participant_b and blocked_id = new.participant_a)
  ) then
    raise exception 'blocked';
  end if;
  if not public.are_friends(new.participant_a, new.participant_b) then
    new.status := 'request';
    new.requester_id := coalesce(auth.uid(), new.participant_a);
  end if;
  return new;
end $function$;

create or replace function public.create_group_conversation(p_title text, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  uid uuid := auth.uid();
  member uuid;
  conv_id uuid;
  clean_title text := nullif(left(btrim(coalesce(p_title, '')), 40), '');
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_member_ids is null or coalesce(array_length(p_member_ids, 1), 0) < 1 then
    raise exception 'members_required';
  end if;
  if array_length(p_member_ids, 1) > 15 then raise exception 'too_many_members'; end if;
  foreach member in array p_member_ids loop
    if member = uid then continue; end if;
    if not public.are_friends(uid, member) then raise exception 'members_must_be_friends'; end if;
    if public.is_blocked(uid, member) then raise exception 'blocked'; end if;
  end loop;
  insert into conversations (is_group, title, created_by, status)
  values (true, clean_title, uid, 'active')
  returning id into conv_id;
  insert into conversation_participants (conversation_id, user_id)
  select conv_id, m from unnest(array_append(p_member_ids, uid)) as m
  on conflict do nothing;
  return conv_id;
end $function$;

-- 2) Push title for an untitled group = the recipient's view of the members.
create or replace function public.group_display_name(p_conversation uuid, p_viewer uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(btrim(c.title), '') from conversations c where c.id = p_conversation),
    (
      select case
        when count(*) = 0 then 'Group'
        when count(*) = 1 then min(split_part(p.display_name, ' ', 1))
        else left(
          array_to_string((array_agg(split_part(p.display_name, ' ', 1) order by cp.joined_at))[1:count(*) - 1], ', ')
            || ' & ' || (array_agg(split_part(p.display_name, ' ', 1) order by cp.joined_at))[count(*)],
          60)
      end
      from conversation_participants cp
      join profiles p on p.id = cp.user_id
      where cp.conversation_id = p_conversation and cp.user_id <> p_viewer
    ),
    'Group'
  );
$$;

create or replace function public.notify_dm()
returns trigger language plpgsql security definer set search_path = public as $function$
declare
  conv conversations%rowtype;
  recipient uuid;
  muted_thread boolean;
  preview_ok boolean;
  payload jsonb;
begin
  select * into conv from conversations where id = new.conversation_id;
  if conv.id is null then return new; end if;
  if conv.is_group then
    for recipient in
      select cp.user_id from conversation_participants cp
      where cp.conversation_id = new.conversation_id
        and cp.user_id <> new.sender_id
        and not coalesce(cp.muted, false)
    loop
      select coalesce(dm_preview_enabled, true) into preview_ok from profiles where id = recipient;
      payload := jsonb_build_object(
        'conversation_id', new.conversation_id::text,
        'is_group', true,
        'group_title', public.group_display_name(new.conversation_id, recipient)
      );
      if preview_ok and new.content is not null then
        payload := payload || jsonb_build_object('messagePreview', left(new.content, 140));
      end if;
      perform dispatch_notification(recipient, new.sender_id, 'dm', 'dm:' || new.id::text || ':' || recipient::text, payload);
    end loop;
    return new;
  end if;
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
end $function$;
