-- Supports the feed's keyset pagination (F1): ORDER BY created_at DESC with a
-- created_at < cursor scan. RLS scopes visibility, so the feed query doesn't
-- filter user_id (the existing posts_feed_idx leads with user_id and can't
-- serve this ordering).
create index if not exists posts_created_desc_idx on public.posts (created_at desc);
