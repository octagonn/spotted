-- Accent-insensitive gym search.
--
-- Gyms whose names carry diacritics were effectively invisible. The real
-- Ladera Ranch location is stored under its brand styling, "EōS Fitness", so a
-- user typing "EOS Fitness" never matched it: a gym 0 mi away lost to one
-- 5.7 mi away. 303 of 25,072 gym rows contain non-ASCII characters, so this is
-- a systemic search gap, not a one-off data problem.
--
-- unaccent() is only STABLE, so it cannot appear in an index expression. The
-- standard workaround is an IMMUTABLE wrapper that pins the dictionary
-- explicitly (the dictionary argument is what makes the result deterministic).

create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
set search_path to 'public'
as $$
  select public.unaccent('public.unaccent'::regdictionary, $1)
$$;

-- Expression trigram indexes mirroring gyms_name_trgm_idx /
-- gyms_address_trgm_idx. Without these the unaccented ILIKE could not use an
-- index and every search would scan 25k rows.
create index if not exists gyms_name_unaccent_trgm_idx
  on public.gyms using gin (public.immutable_unaccent(name) extensions.gin_trgm_ops);

create index if not exists gyms_address_unaccent_trgm_idx
  on public.gyms using gin (public.immutable_unaccent(address) extensions.gin_trgm_ops);

-- Identical to the previous definition except for the match predicate: both
-- the stored name/address and the user's query are unaccented before
-- comparing. Unaccenting a plain-ASCII query is a no-op, so every row that
-- matched before still matches.
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
language sql
stable
set search_path to 'public'
as $function$
  select g.id, g.name, g.address, g.latitude, g.longitude,
         case
           when p_latitude is null or p_longitude is null then null
           else earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(g.latitude, g.longitude))
         end as distance_meters
  from public.gyms g
  where g.category in ('gym', 'yoga', 'pilates')
    and (
      p_query is null
      or btrim(p_query) = ''
      or public.immutable_unaccent(g.name)
           ilike '%' || public.immutable_unaccent(btrim(p_query)) || '%'
      or public.immutable_unaccent(coalesce(g.address, ''))
           ilike '%' || public.immutable_unaccent(btrim(p_query)) || '%'
    )
  order by
    case
      when p_latitude is null or p_longitude is null then null
      else earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(g.latitude, g.longitude))
    end asc nulls last,
    g.name asc,
    g.id asc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

-- Bring the one gym this actually surfaced in beta onto the chain's naming
-- convention ("EOS Fitness — <Area>", used by ~100 sibling rows). It was
-- imported from OSM under the brand styling and had no location qualifier,
-- so it was both unsearchable and ambiguous next to its siblings.
update public.gyms
set name = 'EOS Fitness — Ladera Ranch'
where external_id = 'way/30994306' and name = 'EōS Fitness';
