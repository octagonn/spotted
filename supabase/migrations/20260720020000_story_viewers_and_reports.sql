-- Story owners can read view records for their own stories ("seen by" list);
-- + a reports table for App Store UGC moderation. (2026-07-20)
drop policy if exists story_views_select_owner on public.story_views;
create policy story_views_select_owner on public.story_views
  for select to authenticated
  using (
    exists (
      select 1 from public.stories s
      where s.id = story_views.story_id and s.user_id = (select auth.uid())
    )
  );

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('post','story','user','comment')),
  content_id uuid not null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  note text,
  status text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_content_idx on public.reports (content_type, content_id);
create index if not exists reports_status_idx on public.reports (status);
alter table public.reports enable row level security;
drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));
drop policy if exists reports_select_self on public.reports;
create policy reports_select_self on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));
