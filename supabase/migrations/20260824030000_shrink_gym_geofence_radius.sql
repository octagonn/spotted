-- Beta feedback: "says I'm at the gym when I drive by the front." 75 m from
-- the gym centroid reaches the street in front of most gyms; 40 m still covers
-- the building interior (+GPS drift) but excludes passing traffic.
alter table gyms alter column geofence_radius_meters set default 40;
update gyms set geofence_radius_meters = 40 where geofence_radius_meters = 75;
