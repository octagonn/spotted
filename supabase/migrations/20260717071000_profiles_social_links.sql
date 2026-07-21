-- Social media links shown on the profile. Stored as a small JSON object of
-- per-platform handles/URLs, e.g. {"instagram":"user","website":"https://..."}.
alter table public.profiles
  add column if not exists social_links jsonb not null default '{}'::jsonb;
