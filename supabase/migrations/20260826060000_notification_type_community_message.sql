-- Group-chat pushes (spec: follow DM rules, mute-per-group). Separate
-- migration: a new enum value can't be used in the transaction that adds it.
alter type public.notification_type add value if not exists 'community_message';
