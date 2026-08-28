-- US-scale gym map: the client fetches only the visible viewport instead of
-- downloading the whole table. Plain btree carries the bbox range scan.
create index if not exists gyms_lat_lng_idx on public.gyms (latitude, longitude);

-- Fitness venues inside a bounding box, closest-to-center first so the cap
-- trims the edges (not arbitrary rows) in dense metros. RLS applies (invoker).
create or replace function public.gyms_in_bounds(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_limit integer default 2500
)
returns table(id uuid, name text, address text, latitude double precision, longitude double precision, category text)
language sql stable
set search_path = public
as $$
  select g.id, g.name, g.address, g.latitude, g.longitude, g.category
  from gyms g
  where g.latitude between p_min_lat and p_max_lat
    and g.longitude between p_min_lng and p_max_lng
    and g.category in ('gym', 'yoga', 'pilates')
  order by
    power(g.latitude - (p_min_lat + p_max_lat) / 2, 2)
    + power((g.longitude - (p_min_lng + p_max_lng) / 2) * cos(radians((p_min_lat + p_max_lat) / 2)), 2)
  limit least(greatest(coalesce(p_limit, 2500), 1), 4000);
$$;

grant execute on function public.gyms_in_bounds(double precision, double precision, double precision, double precision, integer) to authenticated;
revoke execute on function public.gyms_in_bounds(double precision, double precision, double precision, double precision, integer) from anon;
