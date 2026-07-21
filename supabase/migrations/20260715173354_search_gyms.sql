-- Gym search + nearby-first ordering for onboarding "pick your gym".
-- Paginated (capped limit) so the client never pulls the whole table.

create extension if not exists pg_trgm with schema extensions;

-- Substring search support for name/address lookups.
create index if not exists gyms_name_trgm_idx
  on public.gyms using gin (name extensions.gin_trgm_ops);
create index if not exists gyms_address_trgm_idx
  on public.gyms using gin (address extensions.gin_trgm_ops);

create or replace function public.search_gyms(
  p_query text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision
)
language sql
stable
security invoker
set search_path = public
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

revoke execute on function public.search_gyms(text, double precision, double precision, integer, integer) from public;
revoke execute on function public.search_gyms(text, double precision, double precision, integer, integer) from anon;
grant execute on function public.search_gyms(text, double precision, double precision, integer, integer) to authenticated;
