-- Private story likes (Instagram-style): only the liker and the story owner can
-- see a like; there are no public counts anywhere.
create table if not exists public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

alter table public.story_likes enable row level security;

create policy "story_likes_insert_own" on public.story_likes
  for insert with check (auth.uid() = user_id);
create policy "story_likes_delete_own" on public.story_likes
  for delete using (auth.uid() = user_id);
create policy "story_likes_select_own_or_owner" on public.story_likes
  for select using (
    auth.uid() = user_id
    or auth.uid() = (select s.user_id from public.stories s where s.id = story_id)
  );
