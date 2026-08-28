-- Private stories: owner-curated audience lists for story posts.
-- A story row with private_story_id set is visible ONLY to the owner and the
-- list's members (plus the usual expiry/block/moderation gates).

create table public.private_stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.private_story_members (
  story_id uuid not null references public.private_stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

alter table public.stories
  add column private_story_id uuid references public.private_stories(id) on delete cascade;

create index private_stories_owner_idx on public.private_stories(owner_id);
create index private_story_members_user_idx on public.private_story_members(user_id);
create index stories_private_story_idx on public.stories(private_story_id) where private_story_id is not null;

-- SECURITY DEFINER membership check (same pattern as are_friends/is_blocked) so
-- the stories SELECT policy can reference membership without recursive RLS.
create or replace function public.is_private_story_member(viewer uuid, ps uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.private_story_members m
    where m.story_id = ps and m.user_id = viewer
  );
$$;

revoke all on function public.is_private_story_member(uuid, uuid) from anon;

alter table public.private_stories enable row level security;
alter table public.private_story_members enable row level security;

-- Owners manage their lists; members can see the list they belong to (name in rail).
create policy private_stories_select on public.private_stories
  for select using (
    owner_id = (select auth.uid())
    or public.is_private_story_member((select auth.uid()), id)
  );
create policy private_stories_insert_own on public.private_stories
  for insert with check (owner_id = (select auth.uid()));
create policy private_stories_update_own on public.private_stories
  for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy private_stories_delete_own on public.private_stories
  for delete using (owner_id = (select auth.uid()));

-- Members rows: owner manages; a member can see their own membership.
create policy private_story_members_select on public.private_story_members
  for select using (
    user_id = (select auth.uid())
    or exists (select 1 from public.private_stories ps
               where ps.id = private_story_members.story_id
                 and ps.owner_id = (select auth.uid()))
  );
create policy private_story_members_insert_owner on public.private_story_members
  for insert with check (
    exists (select 1 from public.private_stories ps
            where ps.id = private_story_members.story_id
              and ps.owner_id = (select auth.uid()))
  );
create policy private_story_members_delete_owner on public.private_story_members
  for delete using (
    exists (select 1 from public.private_stories ps
            where ps.id = private_story_members.story_id
              and ps.owner_id = (select auth.uid()))
  );

-- Stories visibility: main stories keep friends-only; private-story posts are
-- gated to the member list instead.
drop policy stories_select_friends on public.stories;
create policy stories_select_friends on public.stories
  for select using (
    ((moderation_status <> 'flagged') or (user_id = (select auth.uid())))
    and (
      user_id = (select auth.uid())
      or (
        expires_at > now()
        and not is_blocked((select auth.uid()), user_id)
        and (
          (private_story_id is null and are_friends((select auth.uid()), user_id))
          or (private_story_id is not null
              and public.is_private_story_member((select auth.uid()), private_story_id))
        )
      )
    )
  );
