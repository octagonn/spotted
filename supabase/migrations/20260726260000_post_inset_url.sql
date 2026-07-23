-- Dual camera (BeReal-style front+back): back frame = media_url, front frame =
-- inset_url, rendered as a corner PIP by FbMedia.
alter table public.posts add column if not exists inset_url text;
