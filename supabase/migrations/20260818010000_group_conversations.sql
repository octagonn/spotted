-- GROUP CHATS. conversation_participants was designed group-ready from day
-- one ("adding groups later = insert >2 participant rows; a/b become
-- nullable"). This flips the DM system's authority from the participant_a/b
-- pair to the membership table, adds group columns, and teaches the pair-
-- shaped triggers to step aside for groups.

-- 1) Group columns + nullable pair (already nullable in prod via the
--    retention migration; DROP NOT NULL is idempotent).
alter table public.conversations
  add column if not exists is_group boolean not null default false,
  add column if not exists title text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.conversations alter column participant_a drop not null;
alter table public.conversations alter column participant_b drop not null;

-- 2) Membership helper (security definer breaks the RLS recursion between
--    conversations and conversation_participants).
create or replace function public.is_conversation_member(p_conversation uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = p_conversation and cp.user_id = p_user
  );
$$;

-- 3) Backfill membership for any conversation predating the auto-add trigger
--    so membership-based policies cover every legacy 1:1 thread.
insert into public.conversation_participants (conversation_id, user_id)
select c.id, c.participant_a from public.conversations c where c.participant_a is not null
on conflict do nothing;
insert into public.conversation_participants (conversation_id, user_id)
select c.id, c.participant_b from public.conversations c where c.participant_b is not null
on conflict do nothing;

-- 4) Membership-based RLS.
drop policy conversations_participants on public.conversations;
create policy conversations_select_member on public.conversations
  for select using (is_conversation_member(id, (select auth.uid())));
-- Direct client inserts stay 1:1 (groups are created via the RPC below).
create policy conversations_insert_pair on public.conversations
  for insert with check (not is_group and (select auth.uid()) in (participant_a, participant_b));
create policy conversations_update_member on public.conversations
  for update using (is_conversation_member(id, (select auth.uid())))
  with check (is_conversation_member(id, (select auth.uid())));
-- 1:1: either side may delete the thread (existing behavior); groups: creator only.
create policy conversations_delete on public.conversations
  for delete using (
    (select auth.uid()) in (participant_a, participant_b)
    or (is_group and created_by = (select auth.uid()))
  );

drop policy messages_participants on public.messages;
create policy messages_participants on public.messages
  for all using (is_conversation_member(conversation_id, (select auth.uid())))
  with check (is_conversation_member(conversation_id, (select auth.uid())));

drop policy "conv_participants_select" on public.conversation_participants;
create policy conv_participants_select on public.conversation_participants
  for select using (is_conversation_member(conversation_id, (select auth.uid())));
-- Leave group = delete your own membership row.
create policy conv_participants_delete_own on public.conversation_participants
  for delete using ((select auth.uid()) = user_id);

drop policy message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions
  for select using (
    exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id, (select auth.uid())))
  );
drop policy message_reactions_insert_own on public.message_reactions;
create policy message_reactions_insert_own on public.message_reactions
  for insert with check (
    (select auth.uid()) = user_id
    and exists (select 1 from messages m where m.id = message_id and is_conversation_member(m.conversation_id, (select auth.uid())))
  );

-- 5) Pair-shaped triggers learn to step aside for groups.
create or replace function public.conversations_gatekeeper()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if new.is_group then
    if new.title is null or length(btrim(new.title)) = 0 then
      raise exception 'group_title_required';
    end if;
    return new; -- friendship/blocks validated by create_group_conversation
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

create or replace function public.conversations_add_participants()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if new.is_group or new.participant_a is null or new.participant_b is null then
    return new; -- group members are inserted by create_group_conversation
  end if;
  insert into conversation_participants (conversation_id, user_id)
  values (new.id, new.participant_a), (new.id, new.participant_b)
  on conflict do nothing;
  return new;
end $function$;

create or replace function public.messages_gatekeeper()
returns trigger language plpgsql security definer set search_path = public as $function$
declare
  conv conversations%rowtype;
  other uuid;
begin
  select * into conv from conversations where id = new.conversation_id;
  if conv.id is null then
    raise exception 'no_conversation';
  end if;
  if conv.is_group then
    if not public.is_conversation_member(conv.id, new.sender_id) then
      raise exception 'not_member';
    end if;
    return new; -- no request flow / pairwise gates in groups
  end if;
  other := case when new.sender_id = conv.participant_a then conv.participant_b else conv.participant_a end;
  if exists (
    select 1 from user_blocks
    where (blocker_id = new.sender_id and blocked_id = other)
       or (blocker_id = other and blocked_id = new.sender_id)
  ) then
    raise exception 'blocked';
  end if;
  if conv.status = 'request' then
    if new.sender_id = conv.requester_id then
      if exists (
        select 1 from messages
        where conversation_id = conv.id and sender_id = new.sender_id and deleted_at is null
      ) then
        raise exception 'request_pending';
      end if;
      if new.media_url is not null then
        raise exception 'request_text_only';
      end if;
    else
      -- Recipient replying = implicit approval.
      update conversations set status = 'active' where id = conv.id;
    end if;
  elsif not public.are_friends(new.sender_id, other) then
    -- Unfriended mid-conversation: thread is retained but this sender's new
    -- messages land in the recipient's Requests tab (#18).
    update conversations set status = 'request', requester_id = new.sender_id where id = conv.id;
  end if;
  return new;
end $function$;

-- Push: groups fan out to every unmuted member (dedupe key must include the
-- recipient or the second dispatch collides on 'dm:<message id>').
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
        'group_title', coalesce(conv.title, 'Group')
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

-- View-once works inside groups: membership check instead of the pair.
create or replace function public.mark_message_viewed(p_message uuid)
returns void language plpgsql security definer set search_path = public as $function$
declare
  v_conv uuid;
  v_sender uuid;
  v_media text;
begin
  select conversation_id, sender_id, media_url into v_conv, v_sender, v_media
  from messages where id = p_message and view_once and viewed_at is null;
  if v_conv is null then
    return; -- already viewed / not view-once / missing: idempotent no-op
  end if;
  if v_sender = auth.uid() then
    return; -- sender re-opening their own photo doesn't burn the view
  end if;
  if not public.is_conversation_member(v_conv, auth.uid()) then
    raise exception 'not_participant';
  end if;
  update messages set viewed_at = now(), media_url = null where id = p_message;
  if v_media is not null then
    delete from storage.objects where bucket_id = 'messages' and name = v_media;
  end if;
end;
$function$;

-- 6) Group creation: creator + friends only, capped, title required.
create or replace function public.create_group_conversation(p_title text, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  uid uuid := auth.uid();
  member uuid;
  conv_id uuid;
  clean_title text := left(btrim(coalesce(p_title, '')), 40);
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if clean_title = '' then raise exception 'group_title_required'; end if;
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

-- 7) Chat media readable by anyone who shares a conversation with the
--    uploader (group members aren't necessarily mutual friends).
drop policy if exists messages_read_participants on storage.objects;
create policy messages_read_participants on storage.objects for select to authenticated using (
  bucket_id = 'messages' and (
    (auth.uid())::text = (storage.foldername(name))[1]
    or are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)
    or exists (
      select 1 from conversation_participants me
      join conversation_participants them on them.conversation_id = me.conversation_id
      where me.user_id = auth.uid() and them.user_id = ((storage.foldername(name))[1])::uuid
    )
  )
);
