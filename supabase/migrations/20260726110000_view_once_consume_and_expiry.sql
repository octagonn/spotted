-- WS7: view-once consumption deletes the media server-side, and unopened
-- photos expire after 30 days.

-- Consuming a view-once photo now also destroys the media: the storage
-- object row is removed (the file becomes unreachable — no signed URL can
-- ever be minted again) and media_url is nulled. The viewer client has
-- already fetched its signed URL before calling this, so the open photo
-- stays visible until closed; a re-fetch can only ever see "Opened".
create or replace function public.mark_message_viewed(p_message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
  if not exists (
    select 1 from conversations c
    where c.id = v_conv and auth.uid() in (c.participant_a, c.participant_b)
  ) then
    raise exception 'not_participant';
  end if;
  update messages set viewed_at = now(), media_url = null where id = p_message;
  if v_media is not null then
    delete from storage.objects where bucket_id = 'messages' and name = v_media;
  end if;
end;
$$;

-- Unopened view-once photos self-destruct after 30 days: media destroyed,
-- viewed_at stamped so both sides render the "Opened" (expired) state.
create or replace function public.purge_expired_view_once()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id, media_url from messages
    where view_once and viewed_at is null and media_url is not null
      and sent_at < now() - interval '30 days'
  loop
    delete from storage.objects where bucket_id = 'messages' and name = r.media_url;
    update messages set viewed_at = now(), media_url = null where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.purge_expired_view_once() from public;

-- Daily sweep at 04:10 UTC (idempotent re-schedule).
do $$
begin
  perform cron.unschedule('purge-expired-view-once');
exception when others then
  null; -- not scheduled yet
end;
$$;
select cron.schedule('purge-expired-view-once', '10 4 * * *', 'select public.purge_expired_view_once()');
