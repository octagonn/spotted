-- Free-plan DB budget + gym search speed.
--
-- The gyms table was 51 MB of the 112 MB database, 44 MB of it indexes — and
-- pg_stat showed the two unaccent trigram indexes from
-- 20260819050000_gym_search_accent_insensitive had NEVER been scanned.
-- search_gyms could not use them: the `p_query is null or …` OR forces a
-- sequential scan, and the address predicate wraps the column in coalesce(),
-- which does not match the index expression. Every search unaccented 25k
-- rows twice (~360 ms cold, 1.5 s measured through the RPC).
--
-- 1. search_gyms branches on an empty query in plpgsql, so the query path is
--    a plain trigram ILIKE the GIN indexes can serve. NULL address simply
--    doesn't match, which is what coalesce(address, '') achieved anyway.
-- 2. Drop the indexes nothing can use: the pre-unaccent trigram pair
--    (superseded) and the ll_to_earth GiST (no query uses earth_box, and
--    ORDER BY earth_distance can't use it). ~19 MB.

drop function if exists public.search_gyms(text, double precision, double precision, integer, integer);

create or replace function public.search_gyms(
  p_query text default null::text,
  p_latitude double precision default null::double precision,
  p_longitude double precision default null::double precision,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  id uuid,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision
)
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_q text := public.immutable_unaccent(btrim(coalesce(p_query, '')));
  v_pattern text := '%' || v_q || '%';
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_has_origin boolean := p_latitude is not null and p_longitude is not null;
begin
  if v_q = '' then
    return query
      select g.id, g.name, g.address, g.latitude, g.longitude,
             case when v_has_origin
               then earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(g.latitude, g.longitude))
             end as distance_meters
      from public.gyms g
      where g.category in ('gym', 'yoga', 'pilates')
      order by
        case when v_has_origin
          then earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(g.latitude, g.longitude))
        end asc nulls last,
        g.name asc,
        g.id asc
      limit v_limit offset v_offset;
  else
    return query
      select g.id, g.name, g.address, g.latitude, g.longitude,
             case when v_has_origin
               then earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(g.latitude, g.longitude))
             end as distance_meters
      from public.gyms g
      where g.category in ('gym', 'yoga', 'pilates')
        and (
          public.immutable_unaccent(g.name) ilike v_pattern
          or public.immutable_unaccent(g.address) ilike v_pattern
        )
      order by
        case when v_has_origin
          then earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(g.latitude, g.longitude))
        end asc nulls last,
        g.name asc,
        g.id asc
      limit v_limit offset v_offset;
  end if;
end;
$function$;

revoke execute on function public.search_gyms(text, double precision, double precision, integer, integer) from public;
revoke execute on function public.search_gyms(text, double precision, double precision, integer, integer) from anon;
grant execute on function public.search_gyms(text, double precision, double precision, integer, integer) to authenticated;

drop index if exists public.gyms_name_trgm_idx;
drop index if exists public.gyms_address_trgm_idx;
drop index if exists public.gyms_location_idx;

-- cron.job_run_details logged every */2 and */5 run forever (57k rows, 10 MB).
-- Keep a week. (Scheduled separately via MCP as retention_cron_run_details.)
