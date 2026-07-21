-- Positional photo tags (composer M1): a friend tagged at a point on a specific
-- photo of a post. Coordinates are normalized 0–1 so they render correctly at
-- any size. The non-positional post_tags row (for the TAGGED profile grid +
-- notification) is still written separately, reusing the existing tag path.
create table if not exists public.photo_tags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  photo_index integer not null default 0,
  user_id uuid not null references public.profiles(id) on delete cascade,
  x real not null check (x >= 0 and x <= 1),
  y real not null check (y >= 0 and y <= 1),
  created_at timestamptz not null default now()
);
create index if not exists photo_tags_post_idx on public.photo_tags (post_id);

alter table public.photo_tags enable row level security;
create policy "photo_tags_insert_owner" on public.photo_tags
  for insert with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );
create policy "photo_tags_delete_owner" on public.photo_tags
  for delete using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );
create policy "photo_tags_select_if_post_readable" on public.photo_tags
  for select using (
    exists (select 1 from public.posts p where p.id = post_id)
  );
