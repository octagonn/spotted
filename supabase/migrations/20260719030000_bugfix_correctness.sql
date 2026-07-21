-- Story views: the client upserts on repeat views; without an UPDATE policy
-- every re-view violated RLS (log-confirmed). Allow updating your own row.
drop policy if exists story_views_update_self on public.story_views;
create policy story_views_update_self on public.story_views
  for update to authenticated
  using (viewer_id = (select auth.uid()))
  with check (viewer_id = (select auth.uid()));

-- Selfie-only reactions carry no emoji; the NOT NULL constraint made every
-- reaction selfie insert fail (log-confirmed).
alter table public.post_reactions alter column reaction drop not null;

-- Home Gym / unlisted posting: posts remember which kind of location they
-- were made from so cards can display "Home Gym" (gym_id stays null).
alter table public.posts add column if not exists location_kind text not null default 'other';
alter table public.posts drop constraint if exists posts_location_kind_check;
alter table public.posts add constraint posts_location_kind_check
  check (location_kind in ('gym','home','other'));
update public.posts set location_kind = 'gym' where gym_id is not null;

-- Which second of the 30s music preview the clip starts at.
alter table public.posts add column if not exists music_clip_start integer not null default 0;

-- Tagged friends as real rows (not just @handles in the caption).
create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);
alter table public.post_tags enable row level security;
drop policy if exists post_tags_select on public.post_tags;
create policy post_tags_select on public.post_tags
  for select to authenticated
  using (can_read_post(post_id, (select auth.uid())));
drop policy if exists post_tags_insert_own_post on public.post_tags;
create policy post_tags_insert_own_post on public.post_tags
  for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid())));
drop policy if exists post_tags_delete_own_post on public.post_tags;
create policy post_tags_delete_own_post on public.post_tags
  for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid())));
create index if not exists post_tags_user_idx on public.post_tags(user_id);
