-- Map pins carry chain + institution so the pin sheet / cluster rows can show
-- the shared brand logo without a second lookup.
drop function if exists public.gyms_in_bounds(double precision, double precision, double precision, double precision, integer);
create or replace function public.gyms_in_bounds(p_min_lat double precision, p_min_lng double precision, p_max_lat double precision, p_max_lng double precision, p_limit integer default 2500)
returns table(id uuid, name text, address text, latitude double precision, longitude double precision, category text, chain text, institution text)
language sql stable set search_path = public as $$
  select g.id, g.name, g.address, g.latitude, g.longitude, g.category, g.chain, g.institution
  from gyms g
  where g.latitude between p_min_lat and p_max_lat
    and g.longitude between p_min_lng and p_max_lng
    and g.category in ('gym', 'yoga', 'pilates')
  order by
    power(g.latitude - (p_min_lat + p_max_lat) / 2, 2)
    + power((g.longitude - (p_min_lng + p_max_lng) / 2) * cos(radians((p_min_lat + p_max_lat) / 2)), 2)
  limit least(greatest(coalesce(p_limit, 2500), 1), 4000);
$$;
grant execute on function public.gyms_in_bounds(double precision, double precision, double precision, double precision, integer) to anon, authenticated;
