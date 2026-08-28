-- Community roles & permissions (Discord-style).
-- Each community owns a set of named, colored roles. One is the default for
-- new members; roles flagged is_admin get every permission. The creator
-- (communities.created_by) is the immutable owner and always has everything.
-- RLS on chat / posts / invites / requests consults community_can(); the
-- client reads community_permissions() to gate UI.

create table if not exists public.community_roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 32),
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  position int not null default 0,
  is_default boolean not null default false,
  is_admin boolean not null default false,
  can_view_chat boolean not null default true,
  can_send_messages boolean not null default true,
  can_post boolean not null default true,
  can_invite boolean not null default true,
  can_manage_members boolean not null default false,
  can_manage_roles boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists community_roles_community_idx on public.community_roles (community_id, position);
create unique index if not exists community_roles_one_default on public.community_roles (community_id) where is_default;

alter table public.community_members add column if not exists role_id uuid references public.community_roles(id) on delete set null;
create index if not exists community_members_role_idx on public.community_members (role_id);

-- ---------------------------------------------------------------- permissions
create or replace function public.community_permissions(p_community uuid, p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_owner boolean;
  r public.community_roles%rowtype;
  v_member public.community_members%rowtype;
  none jsonb := jsonb_build_object('member', false, 'owner', false, 'admin', false, 'view_chat', false, 'send_messages', false,
      'post', false, 'invite', false, 'manage_members', false, 'manage_roles', false, 'role_id', null, 'role_name', null);
begin
  if p_user is null then return none; end if;
  select (c.created_by = p_user) into v_owner from communities c where c.id = p_community;
  if v_owner is null then return none; end if;
  select * into v_member from community_members m where m.community_id = p_community and m.user_id = p_user;
  if v_member.user_id is null then
    return jsonb_build_object('member', false, 'owner', v_owner, 'admin', v_owner, 'view_chat', v_owner, 'send_messages', v_owner,
      'post', v_owner, 'invite', v_owner, 'manage_members', v_owner, 'manage_roles', v_owner, 'role_id', null, 'role_name', null);
  end if;
  if v_member.role_id is not null then
    select * into r from community_roles where id = v_member.role_id;
  end if;
  if r.id is null then
    select * into r from community_roles where community_id = p_community and is_default limit 1;
  end if;
  -- No roles seeded (legacy row): fall back to the old admin/member text.
  if r.id is null then
    return jsonb_build_object('member', true, 'owner', v_owner, 'admin', v_owner or v_member.role = 'admin',
      'view_chat', true, 'send_messages', true, 'post', true, 'invite', true,
      'manage_members', v_owner or v_member.role = 'admin', 'manage_roles', v_owner or v_member.role = 'admin',
      'role_id', null, 'role_name', null);
  end if;
  return jsonb_build_object(
    'member', true,
    'owner', v_owner,
    'admin', v_owner or r.is_admin,
    'view_chat', v_owner or r.is_admin or r.can_view_chat,
    'send_messages', v_owner or r.is_admin or r.can_send_messages,
    'post', v_owner or r.is_admin or r.can_post,
    'invite', v_owner or r.is_admin or r.can_invite,
    'manage_members', v_owner or r.is_admin or r.can_manage_members,
    'manage_roles', v_owner or r.is_admin or r.can_manage_roles,
    'role_id', r.id,
    'role_name', r.name
  );
end $$;

create or replace function public.community_can(p_community uuid, p_user uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((public.community_permissions(p_community, p_user) ->> p_perm)::boolean, false);
$$;

grant execute on function public.community_permissions(uuid, uuid) to authenticated;
grant execute on function public.community_can(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------- seeding
create or replace function public.seed_community_roles(p_community uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from community_roles where community_id = p_community) then return; end if;
  insert into community_roles (community_id, name, color, position, is_admin, can_manage_members, can_manage_roles)
  values (p_community, 'Admin', '#E8B44C', 0, true, true, true);
  insert into community_roles (community_id, name, position, is_default)
  values (p_community, 'Member', 1, true);
end $$;

create or replace function public.community_seed_roles_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_community_roles(new.id);
  return new;
end $$;
drop trigger if exists community_seed_roles on public.communities;
create trigger community_seed_roles after insert on public.communities
  for each row execute function public.community_seed_roles_trigger();

-- Member insert: creator gets the Admin role; everyone else the default role.
create or replace function public.community_member_creator_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role public.community_roles%rowtype;
begin
  perform public.seed_community_roles(new.community_id);
  if exists (select 1 from communities c where c.id = new.community_id and c.created_by = new.user_id) then
    select * into v_role from community_roles where community_id = new.community_id and is_admin order by position limit 1;
    new.role := 'admin';
  else
    select * into v_role from community_roles where community_id = new.community_id and is_default limit 1;
    new.role := 'member';
  end if;
  new.role_id := v_role.id;
  return new;
end $$;

-- Nobody changes role columns through a plain UPDATE; only the RPC below
-- (which sets the bypass flag after its own checks).
create or replace function public.community_members_guard_update()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and coalesce(current_setting('spotted.role_change', true), '') <> '1' then
    new.role := old.role;
    new.role_id := old.role_id;
    new.joined_at := old.joined_at;
    new.community_id := old.community_id;
    new.user_id := old.user_id;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- role RPCs
create or replace function public.set_community_member_role(p_community uuid, p_user uuid, p_role uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_perms jsonb;
  v_role public.community_roles%rowtype;
  v_target_current public.community_roles%rowtype;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  my_perms := public.community_permissions(p_community, me);
  if not (my_perms ->> 'manage_members')::boolean then raise exception 'forbidden'; end if;
  if exists (select 1 from communities where id = p_community and created_by = p_user) then
    raise exception 'owner_role_locked';
  end if;
  if p_user = me and not (my_perms ->> 'owner')::boolean then raise exception 'cannot_change_own_role'; end if;
  select * into v_role from community_roles where id = p_role and community_id = p_community;
  if v_role.id is null then raise exception 'role_not_found'; end if;
  select r.* into v_target_current from community_members m left join community_roles r on r.id = m.role_id
    where m.community_id = p_community and m.user_id = p_user;
  -- Granting or revoking admin needs admin.
  if (v_role.is_admin or coalesce(v_target_current.is_admin, false)) and not (my_perms ->> 'admin')::boolean then
    raise exception 'admin_required';
  end if;
  perform set_config('spotted.role_change', '1', true);
  update community_members set role_id = v_role.id, role = case when v_role.is_admin then 'admin' else 'member' end
    where community_id = p_community and user_id = p_user;
  if not found then raise exception 'not_a_member'; end if;
end $$;

create or replace function public.remove_community_member(p_community uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_perms jsonb;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  my_perms := public.community_permissions(p_community, me);
  if not (my_perms ->> 'manage_members')::boolean then raise exception 'forbidden'; end if;
  if exists (select 1 from communities where id = p_community and created_by = p_user) then raise exception 'cannot_remove_owner'; end if;
  if p_user = me then raise exception 'use_leave'; end if;
  if (public.community_permissions(p_community, p_user) ->> 'admin')::boolean and not (my_perms ->> 'admin')::boolean then
    raise exception 'admin_required';
  end if;
  delete from community_members where community_id = p_community and user_id = p_user;
end $$;

grant execute on function public.set_community_member_role(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_community_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- roles RLS
alter table public.community_roles enable row level security;
drop policy if exists community_roles_select on public.community_roles;
create policy community_roles_select on public.community_roles for select using (true);
drop policy if exists community_roles_insert_manage on public.community_roles;
create policy community_roles_insert_manage on public.community_roles for insert
  with check (public.community_can(community_id, (select auth.uid()), 'manage_roles'));
drop policy if exists community_roles_update_manage on public.community_roles;
create policy community_roles_update_manage on public.community_roles for update
  using (public.community_can(community_id, (select auth.uid()), 'manage_roles'))
  with check (public.community_can(community_id, (select auth.uid()), 'manage_roles'));
drop policy if exists community_roles_delete_manage on public.community_roles;
create policy community_roles_delete_manage on public.community_roles for delete
  using (public.community_can(community_id, (select auth.uid()), 'manage_roles'));

-- Guard: the default role is never deleted (make another one default first);
-- admin roles are only created/edited/deleted by admins; the last admin role
-- is never deleted or demoted; community_id is immutable; one default per
-- community is maintained here (the partial unique index backs it).
create or replace function public.community_roles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if tg_op = 'DELETE' then
    if old.is_default then raise exception 'default_role_locked'; end if;
    if old.is_admin then
      if me is not null and not public.community_can(old.community_id, me, 'admin') then raise exception 'admin_required'; end if;
      if not exists (select 1 from community_roles where community_id = old.community_id and is_admin and id <> old.id) then
        raise exception 'last_admin_role';
      end if;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.community_id := old.community_id;
    if (old.is_admin or new.is_admin) and me is not null and not public.community_can(old.community_id, me, 'admin') then
      raise exception 'admin_required';
    end if;
    if old.is_admin and not new.is_admin
       and not exists (select 1 from community_roles where community_id = old.community_id and is_admin and id <> old.id) then
      raise exception 'last_admin_role';
    end if;
    if old.is_default and not new.is_default then raise exception 'default_role_locked'; end if;
    if new.is_default and not old.is_default then
      update community_roles set is_default = false where community_id = new.community_id and is_default and id <> new.id;
    end if;
  else
    if new.is_admin and me is not null and not public.community_can(new.community_id, me, 'admin') then
      raise exception 'admin_required';
    end if;
    if new.is_default then
      update community_roles set is_default = false where community_id = new.community_id and is_default;
    end if;
  end if;
  new.name := btrim(new.name);
  return new;
end $$;
drop trigger if exists community_roles_guard on public.community_roles;
create trigger community_roles_guard before insert or update or delete on public.community_roles
  for each row execute function public.community_roles_guard();

-- ---------------------------------------------------------------- enforce
drop policy if exists community_messages_select_members on public.community_messages;
create policy community_messages_select_members on public.community_messages for select
  using (public.community_can(community_id, (select auth.uid()), 'view_chat'));
drop policy if exists community_messages_insert_members on public.community_messages;
create policy community_messages_insert_members on public.community_messages for insert
  with check (sender_id = (select auth.uid()) and public.community_can(community_id, (select auth.uid()), 'send_messages'));

drop policy if exists post_communities_insert_own_post on public.post_communities;
create policy post_communities_insert_own_post on public.post_communities for insert
  with check (
    exists (select 1 from posts p where p.id = post_communities.post_id and p.user_id = (select auth.uid()))
    and public.community_can(community_id, (select auth.uid()), 'post')
  );

drop policy if exists ci_insert_member on public.community_invites;
create policy ci_insert_member on public.community_invites for insert
  with check (
    inviter_id = (select auth.uid()) and invitee_id <> (select auth.uid())
    and public.community_can(community_id, (select auth.uid()), 'invite')
  );

drop policy if exists cjr_select_self_or_admin on public.community_join_requests;
create policy cjr_select_self_or_admin on public.community_join_requests for select
  using (user_id = (select auth.uid()) or public.community_can(community_id, (select auth.uid()), 'manage_members'));
drop policy if exists cjr_delete_self_or_admin on public.community_join_requests;
create policy cjr_delete_self_or_admin on public.community_join_requests for delete
  using (user_id = (select auth.uid()) or public.community_can(community_id, (select auth.uid()), 'manage_members'));

drop policy if exists communities_update_admin on public.communities;
create policy communities_update_admin on public.communities for update
  using (created_by = (select auth.uid()) or public.community_can(id, (select auth.uid()), 'admin'))
  with check (created_by = (select auth.uid()) or public.community_can(id, (select auth.uid()), 'admin'));

-- ---------------------------------------------------------------- backfill
do $$
declare c record;
begin
  for c in select id from communities loop
    perform public.seed_community_roles(c.id);
  end loop;
  update community_members m set role_id = r.id
    from community_roles r
    where r.community_id = m.community_id and m.role_id is null
      and ((m.role = 'admin' and r.is_admin) or (m.role <> 'admin' and r.is_default));
end $$;
