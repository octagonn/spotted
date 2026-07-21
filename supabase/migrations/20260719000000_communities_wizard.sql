-- Community wizard fields: photo, description, expanded types, privacy,
-- optional location (null = global), and pending join requests for private
-- communities. The special 'gym' type (requires gym_id + geoverified posting)
-- is untouched — the wizard's "Gym crew" option is the new 'crew' type, which
-- is a normal community, not a mapped gym.

alter table public.communities
  add column if not exists photo_url text,
  add column if not exists description text,
  add column if not exists privacy text not null default 'public',
  add column if not exists location text;

-- Name up to 126 chars; description max 1251; privacy constrained.
alter table public.communities drop constraint if exists communities_name_check;
alter table public.communities
  add constraint communities_name_check check (char_length(name) between 2 and 126);
alter table public.communities drop constraint if exists communities_description_check;
alter table public.communities
  add constraint communities_description_check
  check (description is null or char_length(description) <= 1251);
alter table public.communities drop constraint if exists communities_privacy_check;
alter table public.communities
  add constraint communities_privacy_check check (privacy in ('public','private'));

-- Expand type set: gym (mapped, RPC-only), crew (Gym crew), friends, college,
-- creator, brand, fun, custom (legacy).
alter table public.communities drop constraint if exists communities_type_check;
alter table public.communities
  add constraint communities_type_check
  check (type in ('gym','crew','friends','college','creator','brand','fun','custom'));

-- Let the wizard insert the new types (gym stays RPC-only).
drop policy if exists communities_insert_custom on public.communities;
create policy communities_insert_custom on public.communities
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and type in ('crew','friends','college','creator','brand','fun','custom')
  );

-- Admins (creator) can edit their community's settings.
drop policy if exists communities_update_admin on public.communities;
create policy communities_update_admin on public.communities
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- Pending join requests (private communities).
create table if not exists public.community_join_requests (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_join_requests enable row level security;

drop policy if exists cjr_insert_self on public.community_join_requests;
create policy cjr_insert_self on public.community_join_requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists cjr_select_self_or_admin on public.community_join_requests;
create policy cjr_select_self_or_admin on public.community_join_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.communities c
      where c.id = community_id and c.created_by = auth.uid()
    )
  );

drop policy if exists cjr_delete_self_or_admin on public.community_join_requests;
create policy cjr_delete_self_or_admin on public.community_join_requests
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.communities c
      where c.id = community_id and c.created_by = auth.uid()
    )
  );

-- Admin approves/denies a request. Approve inserts membership (bypassing the
-- self-join-only RLS) and clears the request; deny just clears it.
create or replace function public.respond_join_request(
  p_community_id uuid,
  p_user_id uuid,
  p_accept boolean
) returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from communities
    where id = p_community_id and created_by = auth.uid()
  ) then
    raise exception 'not_admin';
  end if;
  if p_accept then
    insert into community_members (community_id, user_id)
    values (p_community_id, p_user_id)
    on conflict do nothing;
  end if;
  delete from community_join_requests
  where community_id = p_community_id and user_id = p_user_id;
end;
$$;
revoke execute on function public.respond_join_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.respond_join_request(uuid, uuid, boolean) to authenticated;

-- Joining a private community directly is admin-approval-only: tighten the
-- self-join policy so it only applies to public communities (or the admin).
drop policy if exists community_members_join_self on public.community_members;
create policy community_members_join_self on public.community_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.communities c
      where c.id = community_id and (c.privacy = 'public' or c.created_by = auth.uid())
    )
  );
