-- Poster frame for video posts: generated on upload (expo-video-thumbnails at
-- ~1000ms), stored as a path in the posts bucket. Null for older videos until
-- backfilled; the client renders a bg.subtle cell + play icon in that case.
alter table public.posts add column if not exists thumbnail_url text;
