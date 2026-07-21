-- DM push (#23): a message insert now creates a 'dm' notification for the
-- recipient, which the existing enqueue_push trigger fans out to send-push.
-- Honors per-thread mute (#17 — muted → no notification) and the recipient's
-- preview pref (#23 — off → body is just "New message", no content).
create or replace function public.notify_dm()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  conv conversations%rowtype;
  recipient uuid;
  muted_thread boolean;
  preview_ok boolean;
begin
  select * into conv from conversations where id = new.conversation_id;
  if conv.id is null then return new; end if;
  recipient := case when new.sender_id = conv.participant_a then conv.participant_b else conv.participant_a end;
  if recipient is null then return new; end if;

  select coalesce(muted, false) into muted_thread
    from conversation_participants
    where conversation_id = new.conversation_id and user_id = recipient;
  if muted_thread then return new; end if;

  select coalesce(dm_preview_enabled, true) into preview_ok from profiles where id = recipient;

  insert into notifications (recipient_id, actor_id, type, payload)
  values (
    recipient,
    new.sender_id,
    'dm',
    case
      when preview_ok and new.content is not null
        then jsonb_build_object('messagePreview', left(new.content, 140), 'conversation_id', new.conversation_id::text)
      else jsonb_build_object('conversation_id', new.conversation_id::text)
    end
  );
  return new;
exception when others then
  return new;
end $$;

revoke execute on function public.notify_dm() from public, anon, authenticated;

drop trigger if exists messages_notify_dm on public.messages;
create trigger messages_notify_dm
  after insert on public.messages
  for each row execute function public.notify_dm();
