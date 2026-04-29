alter table posts add column if not exists music_title text;
alter table posts add column if not exists music_artist text;
alter table posts add column if not exists replay_count int not null default 0;
alter table posts add column if not exists reply_count int not null default 0;
alter table posts add column if not exists is_daily_drop boolean not null default true;
alter table posts add column if not exists permanent boolean not null default false;

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 240),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists post_comments_post_idx on post_comments (post_id, created_at desc);
create index if not exists post_comments_user_idx on post_comments (user_id, created_at desc);

create table if not exists post_replays (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  viewer_id uuid not null references profiles(id) on delete cascade,
  replayed_at timestamptz not null default now()
);
create index if not exists post_replays_post_idx on post_replays (post_id, replayed_at desc);
create index if not exists post_replays_viewer_idx on post_replays (viewer_id, replayed_at desc);

create table if not exists profile_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  viewer_id uuid not null references profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  check (profile_id <> viewer_id)
);
create index if not exists profile_views_profile_idx on profile_views (profile_id, viewed_at desc);
create index if not exists profile_views_viewer_idx on profile_views (viewer_id, viewed_at desc);

alter table post_comments enable row level security;
alter table post_replays enable row level security;
alter table profile_views enable row level security;

drop policy if exists post_comments_select_readable on post_comments;
create policy post_comments_select_readable on post_comments for select using (
  user_id = auth.uid()
  or exists (select 1 from posts p where p.id = post_comments.post_id and p.user_id = auth.uid())
  or can_read_post(post_id, auth.uid())
);

drop policy if exists post_comments_insert_self on post_comments;
create policy post_comments_insert_self on post_comments for insert with check (
  user_id = auth.uid() and can_read_post(post_id, auth.uid())
);

drop policy if exists post_comments_update_self on post_comments;
create policy post_comments_update_self on post_comments for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists post_comments_delete_self on post_comments;
create policy post_comments_delete_self on post_comments for delete using (user_id = auth.uid());

drop policy if exists post_replays_select_owner_or_self on post_replays;
create policy post_replays_select_owner_or_self on post_replays for select using (
  viewer_id = auth.uid()
  or exists (select 1 from posts p where p.id = post_replays.post_id and p.user_id = auth.uid())
);

drop policy if exists post_replays_insert_self on post_replays;
create policy post_replays_insert_self on post_replays for insert with check (
  viewer_id = auth.uid() and can_read_post(post_id, auth.uid())
);

drop policy if exists profile_views_select_owner_or_self on profile_views;
create policy profile_views_select_owner_or_self on profile_views for select using (
  profile_id = auth.uid() or viewer_id = auth.uid()
);

drop policy if exists profile_views_insert_self on profile_views;
create policy profile_views_insert_self on profile_views for insert with check (
  viewer_id = auth.uid()
  and profile_id <> auth.uid()
  and exists (select 1 from profiles p where p.id = profile_views.profile_id and not is_blocked(p.id, auth.uid()))
);

create or replace function bump_post_reply_count() returns trigger as $$
begin
  update posts set reply_count = reply_count + 1, updated_at = now() where id = new.post_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists post_comments_bump_reply_count on post_comments;
create trigger post_comments_bump_reply_count after insert on post_comments
  for each row execute function bump_post_reply_count();

create or replace function bump_post_replay_count() returns trigger as $$
begin
  update posts set replay_count = replay_count + 1, updated_at = now() where id = new.post_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists post_replays_bump_replay_count on post_replays;
create trigger post_replays_bump_replay_count after insert on post_replays
  for each row execute function bump_post_replay_count();
