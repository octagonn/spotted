-- No DM notification/push while the recipient has that thread open. The
-- client heartbeats the open conversation (set_active_conversation) while
-- the screen is focused and the app is active, and clears it on blur.
alter table public.profiles add column if not exists active_conversation_id uuid;
alter table public.profiles add column if not exists active_conversation_at timestamptz;

create or replace function public.set_active_conversation(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update profiles
  set active_conversation_id = p_conversation,
      active_conversation_at = case when p_conversation is null then null else now() end
  where id = auth.uid();
$$;
grant execute on function public.set_active_conversation(uuid) to authenticated;

create or replace function public.is_viewing_conversation(p_user uuid, p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = p_user
      and active_conversation_id = p_conversation
      and active_conversation_at > now() - interval '75 seconds'
  );
$$;

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
  if conv.is_group then
    for recipient in
      select cp.user_id from conversation_participants cp
      where cp.conversation_id = new.conversation_id
        and cp.user_id <> new.sender_id
        and not coalesce(cp.muted, false)
    loop
      -- Thread open on their screen: realtime already shows it. No push.
      if public.is_viewing_conversation(recipient, new.conversation_id) then continue; end if;
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
  if public.is_viewing_conversation(recipient, new.conversation_id) then return new; end if;
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
