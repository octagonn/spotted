-- Instagram-style stories: unlimited per user, 24h expiry, friends-visible.
-- Media reuses the private `posts` bucket (path <uid>/story-<ts>.jpg), so the
-- existing owner/friends storage read policy already covers story images.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index stories_owner_active_idx on public.stories (user_id, created_at desc);
create index stories_expiry_idx on public.stories (expires_at);

create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index story_views_viewer_idx on public.story_views (viewer_id);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

create policy stories_select_friends on public.stories
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      expires_at > now()
      and not is_blocked((select auth.uid()), user_id)
      and are_friends((select auth.uid()), user_id)
    )
  );
create policy stories_insert_self on public.stories
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy stories_delete_self on public.stories
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy story_views_select_self on public.story_views
  for select to authenticated
  using (viewer_id = (select auth.uid()));
create policy story_views_insert_self on public.story_views
  for insert to authenticated
  with check (viewer_id = (select auth.uid()));

select cron.schedule(
  'stories-expire-sweep',
  '17 * * * *',
  $$delete from public.stories where expires_at < now() - interval '1 hour'$$
);
