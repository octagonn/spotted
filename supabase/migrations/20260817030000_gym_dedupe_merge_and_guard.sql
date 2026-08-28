-- ── Gym duplicate merge + import guard ───────────────────────────────────────
-- The same club can arrive from OSM / Foursquare / chain sites under different
-- spellings ("EōS Fitness" vs "EOS Fitness — Ladera Ranch", 5m apart) — plain
-- lower(name) comparisons never collide on accented variants. Normalize with
-- unaccent + strip non-alphanumerics, then treat same-key OR prefix-key rows
-- within ~165m as one gym. Merging repoints every reference before deleting.
-- (Run against production 2026-08-17; the merge removed 224 duplicates.)

create extension if not exists unaccent;

-- Normalized identity key for a gym name.
create or replace function public.gym_name_key(p_name text)
returns text
language sql immutable
set search_path = public, extensions
as $$
  select regexp_replace(lower(unaccent(coalesce(p_name, ''))), '[^a-z0-9]', '', 'g');
$$;

-- Import guard: does a same-name-ish gym already exist within ~165m?
-- Every seed script's INSERT must filter through this.
create or replace function public.gym_dupe_exists(p_name text, p_lat double precision, p_lng double precision)
returns boolean
language sql stable
set search_path = public, extensions
as $$
  select exists (
    select 1 from gyms g
    where g.latitude between p_lat - 0.0015 and p_lat + 0.0015
      and g.longitude between p_lng - 0.0018 and p_lng + 0.0018
      and (
        gym_name_key(g.name) = gym_name_key(p_name)
        or (length(gym_name_key(g.name)) >= 6 and length(gym_name_key(p_name)) >= 6
            and (gym_name_key(g.name) like gym_name_key(p_name) || '%'
                 or gym_name_key(p_name) like gym_name_key(g.name) || '%'))
      )
  );
$$;

-- One-time merge of existing duplicates (indexed temp table — a naive
-- self-join is O(n²) at 22k rows).
create temp table _gym_norm as
select id, name, latitude, longitude, source, address, created_at, external_id,
  gym_name_key(name) as key,
  floor(latitude / 0.0015)::int as latb,
  floor(longitude / 0.0018)::int as lngb
from gyms;
create index on _gym_norm (latb, lngb);
analyze _gym_norm;

create temp table _gym_pairs as
select a.id as id_a, b.id as id_b
from _gym_norm a
join _gym_norm b
  on b.latb between a.latb - 1 and a.latb + 1
  and b.lngb between a.lngb - 1 and a.lngb + 1
  and a.id < b.id
where abs(a.latitude - b.latitude) < 0.0015
  and abs(a.longitude - b.longitude) < 0.0018
  and length(a.key) >= 6 and length(b.key) >= 6
  and (a.key = b.key or a.key like b.key || '%' or b.key like a.key || '%');

do $$
declare
  pair record;
  keeper uuid;
  dupe uuid;
begin
  for pair in select id_a, id_b from _gym_pairs loop
    if not exists (select 1 from gyms where id = pair.id_a)
       or not exists (select 1 from gyms where id = pair.id_b) then
      continue;
    end if;

    -- Keeper: the source-linked row wins (canonical, uniformly-spelled names
    -- like "EōS Fitness" — per product preference), then source accuracy,
    -- then most-referenced, then oldest. References are repointed either way.
    select id into keeper from (
      select g.id,
        (g.external_id is not null)::int as canonical,
        case g.source when 'foursquare' then 3 when 'chain' then 2 when 'osm' then 1 else 0 end as src,
        (select count(*) from posts p where p.gym_id = g.id)
          + (select count(*) from profiles pr where pr.home_gym_id = g.id)
          + (select count(*) from checkins c where c.gym_id = g.id)
          + (select count(*) from communities cm where cm.gym_id = g.id) as refs,
        g.created_at
      from gyms g where g.id in (pair.id_a, pair.id_b)
      order by canonical desc, src desc, refs desc, created_at asc
      limit 1
    ) pick;
    dupe := case when keeper = pair.id_a then pair.id_b else pair.id_a end;

    -- Both sides own a gym community → merging those is a human call; skip.
    if exists (select 1 from communities where gym_id = dupe)
       and exists (select 1 from communities where gym_id = keeper) then
      continue;
    end if;

    update posts set gym_id = keeper where gym_id = dupe;
    update profiles set home_gym_id = keeper where home_gym_id = dupe;
    update checkins set gym_id = keeper where gym_id = dupe;
    update communities set gym_id = keeper where gym_id = dupe;
    delete from gyms where id = dupe;
  end loop;
end $$;

drop table _gym_pairs;
drop table _gym_norm;
