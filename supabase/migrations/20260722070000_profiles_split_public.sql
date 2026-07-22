-- Weekly split privacy (profile spec #14): whether other users can see the
-- user's weekly split on their profile.
alter table public.profiles
  add column if not exists split_public boolean not null default true;
