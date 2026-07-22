-- Friend profiles were empty: posts_select_visible required expires_at > now()
-- for ALL non-own reads, so a friend's archive (and their streak-calendar day
-- photos) vanished after expiry. Expiry is a FEED concept — the feed query
-- filters .gt(expires_at, now()) itself. Profile archives are visible to
-- friends and to everyone for public accounts; the community-share path keeps
-- the expiry check (it's a feed surface).
drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts
  for select using (
    user_id = (select auth.uid())
    or (
      not is_blocked((select auth.uid()), user_id)
      and (
        are_friends((select auth.uid()), user_id)
        or exists (
          select 1
          from post_communities pc
          join community_members cm on cm.community_id = pc.community_id
          where pc.post_id = posts.id
            and cm.user_id = (select auth.uid())
            and posts.expires_at > now()
        )
        or exists (
          select 1 from profiles pr
          where pr.id = posts.user_id and pr.schedule_visibility = 'public'
        )
      )
    )
  );
