-- Quiet hours should be opt-IN: off by default for new users, and switched
-- off for everyone existing (users kept missing evening notifications and
-- didn't know why).
alter table public.notification_preferences alter column quiet_hours_enabled set default false;
update public.notification_preferences set quiet_hours_enabled = false where quiet_hours_enabled;
