-- Story-reply DMs carry the story media path for an IG-style thumbnail. (2026-07-20)
alter table public.messages add column if not exists reply_story_media text;
