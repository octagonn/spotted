-- Push spec v1 — Phase 1: preferences, delivery log, and the single
-- enforcement gate every notification passes through.
alter type public.notification_type add value if not exists 'daily_nudge';
alter type public.notification_type add value if not exists 'arrival_buzz';

create type public.push_permission_status as enum ('not_asked', 'granted', 'denied');
create type public.friend_checkins_scope as enum ('my_gym', 'all_friends', 'off');

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_token text,
  push_permission_status public.push_permission_status not null default 'not_asked',
  push_prompt_shown_at timestamptz,
  timezone text not null default 'UTC',
  gym_reminders_enabled boolean not null default true,
  daily_nudge_time time not null default '16:30',
  taunts_enabled boolean not null default true,
  friend_checkins_scope public.friend_checkins_scope not null default 'my_gym',
  messages_enabled boolean not null default true,
  friend_requests_enabled boolean not null default true,
  reactions_enabled boolean not null default false,
  quiet_hours_start time not null default '21:00',
  quiet_hours_end time not null default '06:00',
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy notification_preferences_select_own on public.notification_preferences
  for select using (user_id = auth.uid());
create policy notification_preferences_upsert_own on public.notification_preferences
  for insert with check (user_id = auth.uid());
create policy notification_preferences_update_own on public.notification_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  dedupe_key text not null,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  resulted_in_checkin boolean not null default false
);
create unique index if not exists notification_log_dedupe_idx
  on public.notification_log (user_id, dedupe_key);
create index if not exists notification_log_user_sent_idx
  on public.notification_log (user_id, sent_at desc);
alter table public.notification_log enable row level security;
create policy notification_log_select_own on public.notification_log
  for select using (user_id = auth.uid());
