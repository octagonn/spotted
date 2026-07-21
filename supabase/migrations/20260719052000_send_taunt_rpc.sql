-- One-tap streak taunts between friends. Rate-limited to one per target per
-- 12 hours; the preset text rides in the payload.
create or replace function public.send_taunt(p_target uuid, p_text text)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_target is null or p_target = auth.uid() then
    raise exception 'invalid_target';
  end if;
  if not are_friends(auth.uid(), p_target) then
    raise exception 'not_friends';
  end if;
  if p_text is null or char_length(p_text) < 1 or char_length(p_text) > 80 then
    raise exception 'bad_text';
  end if;
  if exists (
    select 1 from notifications
    where type = 'taunt' and actor_id = auth.uid() and recipient_id = p_target
      and created_at > now() - interval '12 hours'
  ) then
    raise exception 'taunt_cooldown';
  end if;
  insert into notifications (recipient_id, actor_id, type, payload)
  values (p_target, auth.uid(), 'taunt', jsonb_build_object('text', p_text));
end $$;
revoke execute on function public.send_taunt(uuid, text) from public, anon;
grant execute on function public.send_taunt(uuid, text) to authenticated;
