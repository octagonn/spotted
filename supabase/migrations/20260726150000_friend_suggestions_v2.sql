-- Quick Add v2: weighted multi-signal scoring instead of coarse tiers.
-- Signals, strongest first:
--   mutual friends (30/each) > same home gym (40) > shared communities
--   (15/each, cap 3) > has interacted with you or you with them —
--   reactions/comments/photo-tags (25) > recently active (7d: 20, 30d: 8)
--   > brand-new joiner boost (6) > popularity tiebreak (capped).
-- Also NEW: blocked users (either direction) are never suggested; any
-- existing friendship row (accepted OR pending) still excludes.
-- Signature and return shape unchanged — client + edge fn untouched.
create or replace function public.get_friend_suggestions(p_user_id uuid, p_limit integer default 20)
returns table(id uuid, username text, display_name text, avatar_url text, mutual_friends_count bigint)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  caller_home_gym uuid;
begin
  select home_gym_id into caller_home_gym from profiles where profiles.id = p_user_id;
  return query
  with caller_friends as (
    select case when f.user_id = p_user_id then f.friend_id else f.user_id end as friend_id
    from friendships f
    where f.status = 'accepted' and p_user_id in (f.user_id, f.friend_id)
  ),
  my_posts as (
    select posts.id from posts where posts.user_id = p_user_id
  ),
  my_communities as (
    select cm.community_id from community_members cm where cm.user_id = p_user_id
  ),
  candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.home_gym_id, p.created_at, p.gym_score
    from profiles p
    where p.id <> p_user_id
      and p.discoverable = true
      and not exists (
        select 1 from friendships f
        where (f.user_id = p_user_id and f.friend_id = p.id)
           or (f.friend_id = p_user_id and f.user_id = p.id)
      )
      and not exists (
        select 1 from user_blocks b
        where (b.blocker_id = p_user_id and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = p_user_id)
      )
  ),
  scored as (
    select
      c.id, c.username, c.display_name, c.avatar_url,
      (
        select count(*) from friendships f
        where f.status = 'accepted' and c.id in (f.user_id, f.friend_id)
          and (case when f.user_id = c.id then f.friend_id else f.user_id end)
              in (select cf.friend_id from caller_friends cf)
      ) as mutuals,
      (caller_home_gym is not null and c.home_gym_id = caller_home_gym) as same_gym,
      least((
        select count(*) from community_members cm
        where cm.user_id = c.id and cm.community_id in (select mc.community_id from my_communities mc)
      ), 3) as shared_communities,
      exists (
        select 1 from post_reactions r
        where (r.user_id = c.id and r.post_id in (select mp.id from my_posts mp))
           or (r.user_id = p_user_id and r.post_id in (select po.id from posts po where po.user_id = c.id))
      ) or exists (
        select 1 from post_comments pc
        where (pc.user_id = c.id and pc.post_id in (select mp.id from my_posts mp))
           or (pc.user_id = p_user_id and pc.post_id in (select po.id from posts po where po.user_id = c.id))
      ) or exists (
        select 1 from post_tags pt
        where (pt.user_id = c.id and pt.post_id in (select mp.id from my_posts mp))
           or (pt.user_id = p_user_id and pt.post_id in (select po.id from posts po where po.user_id = c.id))
      ) as interacted,
      (select max(po.created_at) from posts po where po.user_id = c.id) as last_post_at,
      c.created_at as joined_at,
      (
        select count(*) from friendships f2
        where f2.status = 'accepted' and c.id in (f2.user_id, f2.friend_id)
      ) as friend_count
    from candidates c
  )
  select
    s.id, s.username, s.display_name, s.avatar_url, s.mutuals as mutual_friends_count
  from scored s
  order by
    (
      s.mutuals * 30
      + (case when s.same_gym then 40 else 0 end)
      + s.shared_communities * 15
      + (case when s.interacted then 25 else 0 end)
      + (case
           when s.last_post_at > now() - interval '7 days' then 20
           when s.last_post_at > now() - interval '30 days' then 8
           else 0
         end)
      + (case when s.joined_at > now() - interval '14 days' then 6 else 0 end)
      + least(s.friend_count, 10)
    ) desc,
    s.mutuals desc,
    s.friend_count desc
  limit p_limit;
end;
$$;
