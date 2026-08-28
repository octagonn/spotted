-- ── 1) Realtime publication was EMPTY ────────────────────────────────────────
-- Every postgres_changes subscription in the app (chat screen messages,
-- notifications) has been receiving nothing — the publication had no tables.
-- RLS still gates what each subscriber receives (WAL-RLS).
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- ── 2) Per-user conversation delete (Instagram semantics) ────────────────────
-- Deleting a thread hides it + its history for YOU only; a new message
-- resurrects the thread showing only what came after. The existing
-- conv_participants_update_own RLS policy already permits this update.
alter table public.conversation_participants add column if not exists cleared_at timestamptz;

-- ── 3) Batch mutual-friend counts (find-friends rows) ────────────────────────
create or replace function public.mutual_friend_counts(p_ids uuid[])
returns table(user_id uuid, mutual_count bigint)
language sql stable security definer
set search_path = public
as $$
  with caller_friends as (
    select case when f.user_id = auth.uid() then f.friend_id else f.user_id end as fid
    from friendships f
    where f.status = 'accepted' and auth.uid() in (f.user_id, f.friend_id)
  )
  select t.id, (
    select count(*) from friendships f
    where f.status = 'accepted' and t.id in (f.user_id, f.friend_id)
      and (case when f.user_id = t.id then f.friend_id else f.user_id end)
          in (select cf.fid from caller_friends cf)
  )
  from unnest(p_ids) as t(id)
  where coalesce(array_length(p_ids, 1), 0) <= 100
    and t.id <> auth.uid();
$$;
grant execute on function public.mutual_friend_counts(uuid[]) to authenticated;
revoke execute on function public.mutual_friend_counts(uuid[]) from anon;

-- ── 4) Contacts matching ─────────────────────────────────────────────────────
-- Matches the caller's address book (emails + phone digits) against
-- auth.users. Returns ONLY matches (never echoes misses), respects
-- discoverable/blocks, and excludes anyone with an existing friendship row.
-- Phone match: exact digits or last-10 (US numbers with/without country code).
create or replace function public.match_contacts(p_emails text[], p_phones text[])
returns table(id uuid, username text, display_name text, avatar_url text, mutual_friends_count bigint)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(array_length(p_emails, 1), 0) > 2000 or coalesce(array_length(p_phones, 1), 0) > 2000 then
    raise exception 'too_many_contacts';
  end if;
  return query
  with emails as (
    select distinct lower(trim(e)) as email
    from unnest(coalesce(p_emails, '{}'::text[])) as e
    where e is not null and trim(e) <> ''
  ),
  phones as (
    select distinct regexp_replace(ph, '\D', '', 'g') as digits
    from unnest(coalesce(p_phones, '{}'::text[])) as ph
    where ph is not null and length(regexp_replace(ph, '\D', '', 'g')) >= 7
  ),
  matched as (
    select u.id as uid
    from auth.users u
    where (u.email is not null and lower(u.email) in (select em.email from emails em))
       or (u.phone is not null and (
             regexp_replace(u.phone, '\D', '', 'g') in (select ph.digits from phones ph)
             or (length(regexp_replace(u.phone, '\D', '', 'g')) >= 10
                 and right(regexp_replace(u.phone, '\D', '', 'g'), 10)
                     in (select right(ph.digits, 10) from phones ph where length(ph.digits) >= 10))
          ))
  ),
  caller_friends as (
    select case when f.user_id = auth.uid() then f.friend_id else f.user_id end as fid
    from friendships f
    where f.status = 'accepted' and auth.uid() in (f.user_id, f.friend_id)
  )
  select p.id, p.username, p.display_name, p.avatar_url,
    (
      select count(*) from friendships f
      where f.status = 'accepted' and p.id in (f.user_id, f.friend_id)
        and (case when f.user_id = p.id then f.friend_id else f.user_id end)
            in (select cf.fid from caller_friends cf)
    ) as mutual_friends_count
  from profiles p
  join matched m on m.uid = p.id
  where p.id <> auth.uid()
    and p.discoverable = true
    and not exists (
      select 1 from friendships f
      where (f.user_id = auth.uid() and f.friend_id = p.id)
         or (f.friend_id = auth.uid() and f.user_id = p.id)
    )
    and not exists (
      select 1 from user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  limit 200;
end $$;
grant execute on function public.match_contacts(text[], text[]) to authenticated;
revoke execute on function public.match_contacts(text[], text[]) from anon;

-- ── 5) Friend suggestions v3: same formula + a human reason ──────────────────
-- Return type widens (adds reason), so drop + recreate.
drop function if exists public.get_friend_suggestions(uuid, integer);
create function public.get_friend_suggestions(p_user_id uuid, p_limit integer default 20)
returns table(id uuid, username text, display_name text, avatar_url text, mutual_friends_count bigint, reason text)
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
    s.id, s.username, s.display_name, s.avatar_url, s.mutuals as mutual_friends_count,
    case
      when s.mutuals > 0 then null -- client renders the count itself
      when s.same_gym then 'Trains at your gym'
      when s.shared_communities > 0 then 'In your crew circles'
      when s.interacted then 'Interacted with your posts'
      when s.joined_at > now() - interval '14 days' then 'New to Spotted'
      else 'Suggested for you'
    end as reason
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
grant execute on function public.get_friend_suggestions(uuid, integer) to service_role, authenticated;
revoke execute on function public.get_friend_suggestions(uuid, integer) from anon;

-- ── 6) People search hardening: never return self or blocked users ───────────
create or replace function public.search_profiles_fuzzy(q text, max_rows int default 20)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public, extensions
as $$
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
    where p.discoverable = true
      and p.id <> auth.uid()
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
$$;

-- ── 7) Drift backfill (no behavior change) ───────────────────────────────────
-- These three functions existed only in the remote DB (created via dashboard);
-- recorded here so the repo matches production.
create or replace function public.mutual_friends(uid uuid)
returns setof profiles
language sql stable security definer
set search_path = public
as $$
  with me as (
    select case when user_id = auth.uid() then friend_id else user_id end as fid
    from friendships
    where status = 'accepted' and (user_id = auth.uid() or friend_id = auth.uid())
  ),
  them as (
    select case when user_id = uid then friend_id else user_id end as fid
    from friendships
    where status = 'accepted' and (user_id = uid or friend_id = uid)
  )
  select p.* from profiles p
  where p.id in (select fid from me intersect select fid from them)
$$;

create or replace function public.user_friends(uid uuid)
returns setof profiles
language sql stable security definer
set search_path = public
as $$
  select p.* from profiles p
  where p.id in (
    select case when user_id = uid then friend_id else user_id end
    from friendships
    where status = 'accepted' and (user_id = uid or friend_id = uid)
  )
$$;

create or replace function public.profile_counts(uid uuid)
returns table(friends integer, followers integer, following integer, posts integer)
language sql stable security definer
set search_path = public
as $$
  select
    (select count(*) from friendships where status = 'accepted' and (user_id = uid or friend_id = uid))::int,
    (select count(*) from follows where followee_id = uid)::int,
    (select count(*) from follows where follower_id = uid)::int,
    (select count(*) from posts where user_id = uid)::int
$$;
