-- Tagging someone in a post/photo/story notifies them (separate migration:
-- new enum values can't be referenced in the same transaction).
alter type notification_type add value if not exists 'tagged';
