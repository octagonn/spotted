-- Phase C: retroactive/silent block (§5) + restrict/mute (§6).
create or replace function public.block_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_target = uid then return; end if;
  insert into user_blocks (blocker_id, blocked_id) values (uid, p_target) on conflict do nothing;
  delete from friendships f
    where (f.user_id = uid and f.friend_id = p_target)
       or (f.user_id = p_target and f.friend_id = uid);
  update checkins set presence_expires_at = now()
    where user_id in (uid, p_target) and presence_expires_at > now();
end; $$;
revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  delete from user_blocks where blocker_id = uid and blocked_id = p_target;
end; $$;
revoke all on function public.unblock_user(uuid) from public;
grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.is_restricted(p_restrictor uuid, p_restricted uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from restrictions where restrictor_id = p_restrictor and restricted_id = p_restricted);
$$;

create or replace function public.restrict_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_target = uid then return; end if;
  insert into restrictions (restrictor_id, restricted_id) values (uid, p_target) on conflict do nothing;
  insert into taunt_mutes (user_id, muted_id) values (uid, p_target) on conflict do nothing;
end; $$;
revoke all on function public.restrict_user(uuid) from public;
grant execute on function public.restrict_user(uuid) to authenticated;

create or replace function public.unrestrict_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  delete from restrictions where restrictor_id = uid and restricted_id = p_target;
  delete from taunt_mutes where user_id = uid and muted_id = p_target;
end; $$;
revoke all on function public.unrestrict_user(uuid) from public;
grant execute on function public.unrestrict_user(uuid) to authenticated;
