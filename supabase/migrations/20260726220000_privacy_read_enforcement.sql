-- Phase B: server-side read enforcement for the is_private model (§2) +
-- location_audience on check-ins (§3). Applied via MCP; mirrors deployed state.
create or replace function public.is_account_public(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select not is_private from profiles where id = p_user), false);
$$;
create or replace function public.can_view_content(p_viewer uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_viewer = p_target
    or (not is_blocked(p_viewer, p_target)
        and (are_friends(p_viewer, p_target) or is_account_public(p_target)));
$$;
create or replace function public.can_view_location(p_viewer uuid, p_target uuid, p_audience text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_viewer = p_target
    or (not is_blocked(p_viewer, p_target)
        and not is_restricted(p_target, p_viewer)
        and case coalesce(p_audience, 'friends')
          when 'nobody' then false
          when 'close_friends' then exists (select 1 from close_friends cf where cf.user_id = p_target and cf.friend_id = p_viewer)
          else are_friends(p_viewer, p_target)
        end);
$$;
drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts for select using (
  user_id = (select auth.uid())
  or (not is_blocked((select auth.uid()), user_id)
    and (are_friends((select auth.uid()), user_id) or is_account_public(user_id)
      or exists (select 1 from post_communities pc join community_members cm on cm.community_id = pc.community_id
        where pc.post_id = posts.id and cm.user_id = (select auth.uid()) and posts.expires_at > now())))
);
drop policy if exists streaks_select_self_or_friends on public.streaks;
create policy streaks_select_self_or_friends on public.streaks for select using (can_view_content((select auth.uid()), user_id));
drop policy if exists workouts_select_own_or_friends on public.workouts;
create policy workouts_select_own_or_friends on public.workouts for select using (can_view_content((select auth.uid()), user_id));
drop policy if exists checkins_select_self_or_friends on public.checkins;
create policy checkins_select_self_or_friends on public.checkins for select using (can_view_location((select auth.uid()), user_id, audience));
