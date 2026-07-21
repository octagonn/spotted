-- Music on stories: same shape as posts — Apple 30s preview + artwork + the
-- second the poster's chosen clip starts at. Plays while the story is viewed.
alter table public.stories
  add column if not exists music_title text,
  add column if not exists music_artist text,
  add column if not exists music_preview_url text,
  add column if not exists music_artwork_url text,
  add column if not exists music_clip_start integer not null default 0;
