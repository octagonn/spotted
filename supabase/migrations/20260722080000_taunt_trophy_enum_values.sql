-- Spec B/C/D notification types (separate migration: new enum values can't be
-- referenced in the same transaction that adds them).
alter type notification_type add value if not exists 'taunt_answered';
alter type notification_type add value if not exists 'trophy_unlocked';
alter type notification_type add value if not exists 'claim_approved';
alter type notification_type add value if not exists 'claim_rejected';
