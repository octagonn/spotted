create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "cube";
create extension if not exists "earthdistance";

create type schedule_visibility as enum ('public','friends','private');
create type friendship_status as enum ('pending','accepted','blocked');
create type notification_type as enum (
  'friend_request','friend_accepted','post_view','post_reaction',
  'streak_break_friend','streak_milestone','dm','gym_arrival_friend'
);

create table gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  geofence_radius_meters int not null default 75,
  created_at timestamptz not null default now()
);
create index gyms_location_idx on gyms using gist (ll_to_earth(latitude, longitude));
create unique index gyms_dedupe_idx on gyms (lower(name), round(latitude::numeric, 4), round(longitude::numeric, 4));
create unique index gyms_exact_dedupe_idx on gyms (name, latitude, longitude);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (
    char_length(username) between 3 and 20
    and username ~ '^[a-z0-9_]+$'
  ),
  display_name text not null,
  avatar_url text,
  avatar_blurred_url text,
  bio text check (char_length(bio) <= 160),
  home_gym_id uuid references gyms(id) on delete set null,
  schedule_visibility schedule_visibility not null default 'friends',
  ghost_mode boolean not null default false,
  discoverable boolean not null default true,
  gym_score int not null default 0,
  timezone text not null default 'UTC',
  arrival_notifs_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_home_gym_idx on profiles (home_gym_id) where discoverable = true;

create table workout_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  muscle_groups text[] not null default '{}',
  start_time time,
  end_time time,
  unique (user_id, day_of_week)
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  source text not null default 'geofence' check (source in ('geofence','manual','post')),
  verified boolean not null default true
);
create index checkins_user_day_idx on checkins (user_id, checked_in_at);
create index checkins_active_idx on checkins (gym_id) where checked_out_at is null;

create table streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_checkin_date date,
  freeze_tokens int not null default 1
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image','video')),
  caption text check (char_length(caption) <= 200),
  gym_id uuid references gyms(id) on delete set null,
  is_verified_at_gym boolean not null default false,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_feed_idx on posts (user_id, expires_at, created_at desc);

create table post_views (
  post_id uuid references posts(id) on delete cascade,
  viewer_id uuid references profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);

create table post_reactions (
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  reaction text not null check (reaction in ('🔥','💪','😍','👀','💀')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table friendships (
  user_id uuid references profiles(id) on delete cascade,
  friend_id uuid references profiles(id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index friendships_friend_idx on friendships (friend_id, status);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references profiles(id) on delete cascade,
  participant_b uuid not null references profiles(id) on delete cascade,
  last_message_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (participant_a, participant_b),
  check (participant_a < participant_b)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  content text,
  media_url text,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create table skip_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  scheduled_date date not null,
  muscle_groups_missed text[] not null default '{}',
  notified_friends boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, scheduled_date)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  type notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on notifications (recipient_id, created_at desc);
create index notifications_arrival_rate_idx on notifications (recipient_id, actor_id, type, created_at desc);

create table device_tokens (
  user_id uuid references profiles(id) on delete cascade,
  device_token text not null,
  platform text not null check (platform in ('ios')),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_token)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars','avatars', true, 26214400, array['image/jpeg','image/png','image/webp']),
  ('posts','posts', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']),
  ('messages','messages', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
