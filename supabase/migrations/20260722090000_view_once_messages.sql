-- View-once photo messages (Snapchat-style): camera captures sent in a DM are
-- viewable exactly once by the recipient, then collapse to an "Opened" stub.
alter table public.messages
  add column if not exists view_once boolean not null default false,
  add column if not exists viewed_at timestamptz;

-- Recipient marks a view-once message opened. SECURITY DEFINER because the
-- messages UPDATE policy only covers the sender (unsend); the recipient needs
-- exactly this one write.
create or replace function public.mark_message_viewed(p_message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv uuid;
  v_sender uuid;
begin
  select conversation_id, sender_id into v_conv, v_sender
  from messages where id = p_message and view_once and viewed_at is null;
  if v_conv is null then
    return; -- already viewed / not view-once / missing: idempotent no-op
  end if;
  if v_sender = auth.uid() then
    return; -- sender re-opening their own photo doesn't burn the view
  end if;
  if not exists (
    select 1 from conversations c
    where c.id = v_conv and auth.uid() in (c.participant_a, c.participant_b)
  ) then
    raise exception 'not_participant';
  end if;
  update messages set viewed_at = now() where id = p_message;
end;
$$;

revoke all on function public.mark_message_viewed(uuid) from public;
grant execute on function public.mark_message_viewed(uuid) to authenticated;
