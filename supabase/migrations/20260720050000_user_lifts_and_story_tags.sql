-- Manually-logged lifts (source of truth for strength trophies), normalized
-- lift columns on posts, and story tags (mirror of post_tags). (2026-07-20)
create table if not exists public.user_lifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise text not null check (exercise in ('bench','squat','deadlift','pullups','pushups')),
  value real not null check (value > 0 and value < 2000),
  unit text not null check (unit in ('lb','reps')),
  post_id uuid references public.posts(id) on delete set null,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists user_lifts_user_idx on public.user_lifts (user_id, exercise);
alter table public.user_lifts enable row level security;
drop policy if exists user_lifts_insert_self on public.user_lifts;
create policy user_lifts_insert_self on public.user_lifts
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists user_lifts_select_self_or_friends on public.user_lifts;
create policy user_lifts_select_self_or_friends on public.user_lifts
  for select to authenticated
  using (user_id = (select auth.uid()) or are_friends((select auth.uid()), user_id));

alter table public.posts
  add column if not exists lift_exercise text,
  add column if not exists lift_value real,
  add column if not exists lift_unit text;

create table if not exists public.story_tags (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (story_id, user_id)
);
alter table public.story_tags enable row level security;
drop policy if exists story_tags_insert_owner on public.story_tags;
create policy story_tags_insert_owner on public.story_tags
  for insert to authenticated
  with check (exists (select 1 from public.stories s where s.id = story_id and s.user_id = (select auth.uid())));
drop policy if exists story_tags_select on public.story_tags;
create policy story_tags_select on public.story_tags
  for select to authenticated
  using (exists (
    select 1 from public.stories s
    where s.id = story_id
      and (s.user_id = (select auth.uid()) or are_friends((select auth.uid()), s.user_id))
  ));
drop policy if exists story_tags_delete_owner on public.story_tags;
create policy story_tags_delete_owner on public.story_tags
  for delete to authenticated
  using (exists (select 1 from public.stories s where s.id = story_id and s.user_id = (select auth.uid())));
