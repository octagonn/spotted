-- Devices refine gym pins using the platform (Apple) geocoder so markers line
-- up with the basemap users actually see. Tightly guarded: same-address
-- refinements only move a pin up to 400m, and never outside Orange County.
create or replace function public.refine_gym_location(
  p_gym_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_lat double precision;
  v_lon double precision;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_latitude not between 33.33 and 33.98 or p_longitude not between -118.15 and -117.38 then
    return false;
  end if;
  select latitude, longitude into v_lat, v_lon from public.gyms where id = p_gym_id;
  if v_lat is null then
    return false;
  end if;
  if earth_distance(ll_to_earth(v_lat, v_lon), ll_to_earth(p_latitude, p_longitude)) > 400 then
    return false;
  end if;
  update public.gyms set latitude = p_latitude, longitude = p_longitude where id = p_gym_id;
  return true;
end;
$$;
revoke execute on function public.refine_gym_location(uuid, double precision, double precision) from public, anon;
grant execute on function public.refine_gym_location(uuid, double precision, double precision) to authenticated;
