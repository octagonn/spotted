-- Communities tab revamp (spec: spotted-communities-spec).
-- Part 1 (separate transaction semantics): new notification enum values.
alter type notification_type add value if not exists 'wave';
alter type notification_type add value if not exists 'community_nudge';
