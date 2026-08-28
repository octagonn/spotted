-- Product decision (24 Aug): "Discoverable" must NOT affect friend suggestions
-- or search — any user can be suggested and found by name. With 21 of 68 users
-- having switched the toggle off under its old misleading copy, a third of the
-- user base had silently vanished from Add Friends ("for some people, I can't
-- see them on the suggested list").
--
-- What the toggle STILL governs: phone-contact matching (match_contacts) — the
-- one genuinely sensitive surface, where your email/phone number is the lookup
-- key. Settings copy updated to say exactly that.
--
-- search_profiles_fuzzy: the discoverable-only-exact-username branch is gone;
-- everyone scores through the same fuzzy path. get_friend_suggestions: the
-- `p.discoverable = true` candidate filter is gone. Everything else (dismissal
-- as ranking, daily rotation tiebreak) is unchanged from the live definitions.
-- Full definitions applied via MCP on 2026-08-24; this file mirrors them.

create or replace function public.search_profiles_fuzzy(q text, max_rows integer default 20)
returns table(id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  with scored as (
    select p.id, p.username, p.display_name, p.avatar_url,
      greatest(
        similarity(p.username, q),
        similarity(p.display_name, q),
        case when p.username ilike q || '%' then 1.0 else 0 end,
        case when p.username ilike '%' || q || '%' or p.display_name ilike '%' || q || '%' then 0.6 else 0 end,
        case when levenshtein(lower(p.username), lower(q)) <= (case when length(q) >= 6 then 2 else 1 end) then 0.7 else 0 end,
        case when levenshtein(lower(split_part(p.display_name, ' ', 1)), lower(q)) <= (case when length(q) >= 6 then 2 else 1 end) then 0.65 else 0 end
      ) as score
    from profiles p
    where p.id <> auth.uid()
      and not exists (
        select 1 from user_blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
  )
  select s.id, s.username, s.display_name, s.avatar_url
  from scored s
  where s.score >= 0.2
  order by s.score desc
  limit max_rows;
$function$;

create or replace function public.get_friend_suggestions(p_user_id uuid, p_limit integer default 20)
returns table(id uuid, username text, display_name text, avatar_url text, mutual_friends_count bigint, reason text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller_home_gym uuid;
  v_seed text := p_user_id::text || '|' || to_char(now(), 'YYYY-MM-DD');
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
    select p.id, p.username, p.display_name, p.avatar_url, p.home_gym_id, p.created_at, p.gym_score,
           exists (
             select 1 from suggestion_dismissals sd
             where sd.user_id = p_user_id and sd.dismissed_id = p.id
               and sd.dismissed_at > now() - interval '7 days'
           ) as dismissed
    from profiles p
    where p.id <> p_user_id
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
      c.id, c.username, c.display_name, c.avatar_url, c.dismissed,
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
      ) as friend_count,
      ('x' || substr(md5(c.id::text || '|' || v_seed), 1, 8))::bit(32)::int as rotation
    from candidates c
  )
  select
    s.id, s.username, s.display_name, s.avatar_url, s.mutuals as mutual_friends_count,
    case
      when s.mutuals > 0 then null
      when s.same_gym then 'Trains at your gym'
      when s.shared_communities > 0 then 'In your crew circles'
      when s.interacted then 'Interacted with your posts'
      when s.joined_at > now() - interval '14 days' then 'New to Spotted'
      else 'Suggested for you'
    end as reason
  from scored s
  order by
    s.dismissed asc,
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
    s.rotation asc,
    s.mutuals desc,
    s.friend_count desc
  limit p_limit;
end;
$function$;
