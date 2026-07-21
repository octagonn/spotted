-- 1) Tag notifications: post_tags / photo_tags / story_tags inserts notify the
--    tagged user. Deduped per (recipient, post/story) so being tagged in both
--    post_tags and photo_tags on the same post pings once. Never self-notify.

create or replace function public.notify_post_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  if owner is null or owner = new.user_id then
    return new;
  end if;
  if exists (
    select 1 from notifications n
    where n.type = 'tagged' and n.recipient_id = new.user_id
      and n.payload->>'post_id' = new.post_id::text
  ) then
    return new;
  end if;
  insert into notifications (recipient_id, actor_id, type, payload)
  values (new.user_id, owner, 'tagged', jsonb_build_object('post_id', new.post_id, 'kind', 'post'));
  return new;
exception when others then
  return new; -- tagging must never fail because notifying did
end;
$$;

drop trigger if exists post_tags_notify on public.post_tags;
create trigger post_tags_notify
  after insert on public.post_tags
  for each row execute function public.notify_post_tag();

drop trigger if exists photo_tags_notify on public.photo_tags;
create trigger photo_tags_notify
  after insert on public.photo_tags
  for each row execute function public.notify_post_tag();

create or replace function public.notify_story_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select user_id into owner from stories where id = new.story_id;
  if owner is null or owner = new.user_id then
    return new;
  end if;
  if exists (
    select 1 from notifications n
    where n.type = 'tagged' and n.recipient_id = new.user_id
      and n.payload->>'story_id' = new.story_id::text
  ) then
    return new;
  end if;
  insert into notifications (recipient_id, actor_id, type, payload)
  values (new.user_id, owner, 'tagged', jsonb_build_object('story_id', new.story_id, 'kind', 'story'));
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists story_tags_notify on public.story_tags;
create trigger story_tags_notify
  after insert on public.story_tags
  for each row execute function public.notify_story_tag();

-- 2) Typo-tolerant server search (pg_trgm): profiles, communities, gyms.
create extension if not exists pg_trgm with schema extensions;

create index if not exists profiles_username_trgm_idx on public.profiles using gin (username extensions.gin_trgm_ops);
create index if not exists profiles_display_name_trgm_idx on public.profiles using gin (display_name extensions.gin_trgm_ops);
create index if not exists communities_name_trgm_idx on public.communities using gin (name extensions.gin_trgm_ops);
create index if not exists gyms_name_trgm_idx on public.gyms using gin (name extensions.gin_trgm_ops);

-- Fuzzy people search: substring OR trigram-similar on username/display name,
-- ranked by best similarity. Discoverable profiles only (mirrors old query).
create or replace function public.search_profiles_fuzzy(q text, max_rows int default 20)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from profiles p
  where p.discoverable = true
    and (
      p.username ilike '%' || q || '%'
      or p.display_name ilike '%' || q || '%'
      or similarity(p.username, q) > 0.25
      or similarity(p.display_name, q) > 0.25
    )
  order by greatest(
      similarity(p.username, q),
      similarity(p.display_name, q),
      case when p.username ilike q || '%' then 1.0 else 0 end
    ) desc
  limit max_rows;
$$;

-- Fuzzy public-community search (name + description).
create or replace function public.search_communities_fuzzy(q text, max_rows int default 60)
returns setof communities
language sql
stable
security definer
set search_path = public, extensions
as $$
  select c.*
  from communities c
  where c.privacy = 'public'
    and (
      c.name ilike '%' || q || '%'
      or coalesce(c.description, '') ilike '%' || q || '%'
      or similarity(c.name, q) > 0.25
    )
  order by greatest(
      similarity(c.name, q),
      case when c.name ilike q || '%' then 1.0 else 0 end
    ) desc
  limit max_rows;
$$;

grant execute on function public.search_profiles_fuzzy(text, int) to authenticated;
grant execute on function public.search_communities_fuzzy(text, int) to authenticated;

-- 3) Gym search becomes typo-tolerant too. Ordering stays nearest-first.
create or replace function public.search_gyms(
  p_query text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(id uuid, name text, address text, latitude double precision, longitude double precision, distance_meters double precision)
language sql
stable
set search_path to 'public', 'extensions'
as $$
  select g.id, g.name, g.address, g.latitude, g.longitude,
         case
           when p_latitude is null or p_longitude is null then null
           else earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(g.latitude, g.longitude))
         end as distance_meters
  from public.gyms g
  where p_query is null
     or btrim(p_query) = ''
     or g.name ilike '%' || btrim(p_query) || '%'
     or coalesce(g.address, '') ilike '%' || btrim(p_query) || '%'
     or similarity(g.name, btrim(p_query)) > 0.25
     or word_similarity(btrim(p_query), g.name) > 0.4
  order by
    case
      when p_latitude is null or p_longitude is null then null
      else earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(g.latitude, g.longitude))
    end asc nulls last,
    g.name asc,
    g.id asc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
