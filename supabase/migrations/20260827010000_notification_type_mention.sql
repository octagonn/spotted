-- @mentions in comments notify the mentioned user (own enum value; the trigger
-- lands in the next migration because a new enum value can't be used in the
-- transaction that adds it).
alter type public.notification_type add value if not exists 'mention';
