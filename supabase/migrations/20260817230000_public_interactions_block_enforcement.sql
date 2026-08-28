-- Partner-reported bug: posts in the Public tab are readable
-- (posts_select_visible allows is_account_public) but NOT interactable —
-- can_read_post(), which gates every post_reactions / post_comments /
-- post_views / post_replays INSERT, still required friendship. Align it with
-- post visibility: self, or not-blocked AND (friends OR public account OR
-- shared community while the post is live).
create or replace function public.can_read_post(p_post_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p
    where p.id = p_post_id
      and (
        p.user_id = p_user_id
        or (not is_blocked(p_user_id, p.user_id)
          and (are_friends(p_user_id, p.user_id)
            or is_account_public(p.user_id)
            or exists (
              select 1 from post_communities pc
              join community_members cm on cm.community_id = pc.community_id
              where pc.post_id = p.id and cm.user_id = p_user_id and p.expires_at > now())))
      )
  );
$$;

-- Latent enforcement hole: block_user() writes user_blocks, but is_blocked()
-- (used across RLS) still read only the legacy friendships.status='blocked'
-- rows — blocks placed via the newer flow never enforced anywhere. Read BOTH
-- representations.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_blocks ub
    where (ub.blocker_id = a and ub.blocked_id = b)
       or (ub.blocker_id = b and ub.blocked_id = a)
  ) or exists (
    select 1 from friendships f
    where f.status = 'blocked'
      and ((f.user_id = a and f.friend_id = b) or (f.friend_id = a and f.user_id = b))
  );
$$;

-- Your own reaction row must always be selectable (it drives the lit heart),
-- independent of the post-readability path.
drop policy if exists post_reactions_read_if_post_readable on post_reactions;
create policy post_reactions_read_if_post_readable on post_reactions for select
  using (user_id = (select auth.uid()) or can_read_post(post_id, (select auth.uid())));
