-- Music on posts: 30-second Apple preview clip + artwork, attached at compose
-- time via the iTunes Search API (no user sign-in required).
alter table public.posts
  add column if not exists music_preview_url text,
  add column if not exists music_artwork_url text;
