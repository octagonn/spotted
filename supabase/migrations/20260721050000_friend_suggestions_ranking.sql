-- Find Friends ranking (#20). The app's social graph is friendships (no
-- "followers"), so friend_count is the follower-count analog, and home_gym is
-- the locality signal (per-user geo coordinates aren't tracked). Tiers:
--   1. most mutual friends
--   2. local (same home gym), by friend count
--   3. everyone else, by friend count (+ gym_score as a proximity/activity proxy)
create or replace function public.get_friend_suggestions(p_user_id uuid, p_limit integer default 20)
returns table(id uuid, username text, display_name text, avatar_url text, mutual_friends_count bigint)
language plpgsql security definer set search_path to 'public' as $function$
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
  candidate_friends as (
    select p.id as candidate_id,
           case when f.user_id = p.id then f.friend_id else f.user_id end as friend_id
    from profiles p
    join friendships f on f.status = 'accepted' and p.id in (f.user_id, f.friend_id)
  )
  select
    p.id, p.username, p.display_name, p.avatar_url,
    count(cf.friend_id) filter (where cf.friend_id in (select friend_id from caller_friends)) as mutual_friends_count
  from profiles p
  left join candidate_friends cf on cf.candidate_id = p.id
  where p.id <> p_user_id
    and p.discoverable = true
    and not exists (
      select 1 from friendships f
      where (f.user_id = p_user_id and f.friend_id = p.id)
         or (f.friend_id = p_user_id and f.user_id = p.id)
    )
  group by p.id
  order by
    count(cf.friend_id) filter (where cf.friend_id in (select friend_id from caller_friends)) desc,
    (caller_home_gym is not null and p.home_gym_id = caller_home_gym) desc,
    (select count(*) from friendships f2 where f2.status = 'accepted' and p.id in (f2.user_id, f2.friend_id)) desc,
    p.gym_score desc,
    p.created_at desc
  limit p_limit;
end;
$function$;
