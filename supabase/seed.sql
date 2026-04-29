insert into gyms (name, address, latitude, longitude, geofence_radius_meters)
values
  ('Gold''s Gym Chelsea', '250 W 26th St, New York, NY', 40.7472, -73.9935, 85),
  ('Ironworks NoHo', '28 Cooper Sq, New York, NY', 40.7289, -73.9914, 75)
on conflict do nothing;
