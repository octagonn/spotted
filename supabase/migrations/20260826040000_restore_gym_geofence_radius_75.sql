-- Revert 20260824030000: presence radius back to the original 75 m.
alter table gyms alter column geofence_radius_meters set default 75;
update gyms set geofence_radius_meters = 75 where geofence_radius_meters = 40;
