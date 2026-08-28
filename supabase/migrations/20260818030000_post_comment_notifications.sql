-- New notification kind for comment notifications (enum value must be
-- committed before any row can use it — applied as its own migration).
alter type notification_type add value if not exists 'post_comment';
