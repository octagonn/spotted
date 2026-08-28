-- Actor-less system notices (privacy-policy updates, account-wide changes).
-- Separate migration: a new enum value can't be used in the same transaction.
alter type public.notification_type add value if not exists 'system_notice';
