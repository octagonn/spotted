-- Per-friend taunt mute + route taunt notifications through the gate
-- (1 sender->recipient per day, server-enforced via the dedupe index).
create table if not exists public.taunt_mutes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_id)
);
alter table public.taunt_mutes enable row level security;
create policy taunt_mutes_own on public.taunt_mutes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.send_taunt_line(p_target uuid, p_line_id text, p_line_text text, p_since timestamptz)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  uid uuid := auth.uid();
  target_tz text;
  taunt_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_target = uid then raise exception 'cannot_taunt_self'; end if;
  if not are_friends(uid, p_target) then raise exception 'not_friends'; end if;
  if not exists (select 1 from posts where user_id = uid and created_at >= p_since) then
    raise exception 'sender_not_posted';
  end if;
  if exists (select 1 from posts where user_id = p_target and created_at >= p_since) then
    raise exception 'target_already_posted';
  end if;
  if (select count(*) from taunts where sender_id = uid and sent_at >= p_since) >= 5 then
    raise exception 'daily_send_limit';
  end if;
  if exists (select 1 from taunts where sender_id = uid and target_id = p_target and sent_at >= p_since) then
    raise exception 'already_taunted_target';
  end if;
  select timezone into target_tz from profiles where id = p_target;
  if extract(hour from now() at time zone coalesce(nullif(target_tz, ''), 'UTC')) >= 21 then
    raise exception 'target_quiet_hours';
  end if;

  insert into taunts (sender_id, target_id, line_id) values (uid, p_target, p_line_id)
  returning id into taunt_id;

  if not exists (select 1 from taunt_mutes where user_id = p_target and muted_id = uid) then
    perform dispatch_notification(
      p_target, uid, 'taunt',
      'taunt:' || p_target::text || ':' || uid::text || ':' || (now() at time zone coalesce(nullif(target_tz,''),'UTC'))::date::text,
      jsonb_build_object('text', left(p_line_text, 140), 'taunt_id', taunt_id)
    );
  end if;
  return taunt_id;
end $$;
