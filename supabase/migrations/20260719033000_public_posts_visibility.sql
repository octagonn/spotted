-- Real public feed: posts by profiles whose visibility is 'public' are
-- readable by any authenticated user (blocks still respected). Friends,
-- community co-members, and own posts unchanged.
drop policy if exists posts_select_friends on public.posts;
create policy posts_select_visible on public.posts
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      expires_at > now()
      and not is_blocked((select auth.uid()), user_id)
      and (
        are_friends((select auth.uid()), user_id)
        or exists (
          select 1
          from post_communities pc
          join community_members cm on cm.community_id = pc.community_id
          where pc.post_id = posts.id and cm.user_id = (select auth.uid())
        )
        or exists (
          select 1 from profiles pr
          where pr.id = posts.user_id and pr.schedule_visibility = 'public'
        )
      )
    )
  );
