-- Role permission: view posts (community feed). Off = the role can't see the
-- community's posts at all (server-enforced via posts_select_visible).
alter table public.community_roles add column if not exists can_view_posts boolean not null default true;

create or replace function public.community_permissions(p_community uuid, p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_owner boolean;
  r public.community_roles%rowtype;
  v_member public.community_members%rowtype;
  none jsonb := jsonb_build_object('member', false, 'owner', false, 'admin', false, 'view_chat', false, 'send_messages', false,
      'view_posts', false, 'post', false, 'invite', false, 'manage_members', false, 'manage_roles', false, 'role_id', null, 'role_name', null);
begin
  if p_user is null then return none; end if;
  select (c.created_by = p_user) into v_owner from communities c where c.id = p_community;
  if v_owner is null then return none; end if;
  select * into v_member from community_members m where m.community_id = p_community and m.user_id = p_user;
  if v_member.user_id is null then
    return jsonb_build_object('member', false, 'owner', v_owner, 'admin', v_owner, 'view_chat', v_owner, 'send_messages', v_owner,
      'view_posts', v_owner, 'post', v_owner, 'invite', v_owner, 'manage_members', v_owner, 'manage_roles', v_owner, 'role_id', null, 'role_name', null);
  end if;
  if v_member.role_id is not null then
    select * into r from community_roles where id = v_member.role_id;
  end if;
  if r.id is null then
    select * into r from community_roles where community_id = p_community and is_default limit 1;
  end if;
  if r.id is null then
    return jsonb_build_object('member', true, 'owner', v_owner, 'admin', v_owner or v_member.role = 'admin',
      'view_chat', true, 'send_messages', true, 'view_posts', true, 'post', true, 'invite', true,
      'manage_members', v_owner or v_member.role = 'admin', 'manage_roles', v_owner or v_member.role = 'admin',
      'role_id', null, 'role_name', null);
  end if;
  return jsonb_build_object(
    'member', true,
    'owner', v_owner,
    'admin', v_owner or r.is_admin,
    'view_chat', v_owner or r.is_admin or r.can_view_chat,
    'send_messages', v_owner or r.is_admin or r.can_send_messages,
    'view_posts', v_owner or r.is_admin or r.can_view_posts,
    'post', v_owner or r.is_admin or r.can_post,
    'invite', v_owner or r.is_admin or r.can_invite,
    'manage_members', v_owner or r.is_admin or r.can_manage_members,
    'manage_roles', v_owner or r.is_admin or r.can_manage_roles,
    'role_id', r.id,
    'role_name', r.name
  );
end $$;

-- Community-scoped visibility of posts now requires the role's view_posts
-- (friends / public visibility of the same post is unchanged).
drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts for select
  using (
    ((moderation_status <> 'flagged'::text) or (user_id = (select auth.uid())))
    and (
      (user_id = (select auth.uid()))
      or (
        (not is_blocked((select auth.uid()), user_id))
        and (
          are_friends((select auth.uid()), user_id)
          or is_account_public(user_id)
          or exists (
            select 1 from post_communities pc
            where pc.post_id = posts.id
              and posts.expires_at > now()
              and public.community_can(pc.community_id, (select auth.uid()), 'view_posts')
          )
        )
      )
    )
  );
