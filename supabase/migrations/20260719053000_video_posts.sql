-- Real max-lift video posts: soft-trim window (seconds) honored at playback,
-- plus the structured lift tag shown on the card.
alter table public.posts
  add column if not exists video_trim_start real,
  add column if not exists video_trim_end real,
  add column if not exists lift_name text,
  add column if not exists lift_weight text;
