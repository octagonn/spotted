-- Communities v1: gym-bound + custom communities, membership, chat, post cross-posting.
-- (Applied to linked project via MCP as version 20260716063025.)

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  type text not null default 'custom' check (type in ('gym', 'friends', 'college', 'custom')),
  gym_id uuid unique references public.gyms(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (type <> 'gym' or gym_id is not null)
);

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user_idx on public.community_members (user_id);

create table public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  sent_at timestamptz not null default now()
);
create index community_messages_thread_idx on public.community_messages (community_id, sent_at desc);

create table public.post_communities (
  post_id uuid not null references public.posts(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  primary key (post_id, community_id)
);
create index post_communities_community_idx on public.post_communities (community_id);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;
alter table public.post_communities enable row level security;

create or replace function public.is_community_member(p_community_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community_id and user_id = p_user_id
  );
$$;
revoke execute on function public.is_community_member(uuid, uuid) from public, anon;
grant execute on function public.is_community_member(uuid, uuid) to authenticated;

create or replace function public.shares_community_post(p_owner uuid, p_viewer uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.posts p
    join public.post_communities pc on pc.post_id = p.id
    join public.community_members cm on cm.community_id = pc.community_id
    where p.user_id = p_owner and cm.user_id = p_viewer and p.expires_at > now()
  );
$$;
revoke execute on function public.shares_community_post(uuid, uuid) from public, anon;
grant execute on function public.shares_community_post(uuid, uuid) to authenticated;

create policy communities_select on public.communities
  for select to authenticated using (true);
create policy communities_insert_custom on public.communities
  for insert to authenticated
  with check (created_by = (select auth.uid()) and type in ('friends', 'college', 'custom'));

create policy community_members_select on public.community_members
  for select to authenticated using (true);
create policy community_members_join_self on public.community_members
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy community_members_leave_self on public.community_members
  for delete to authenticated using (user_id = (select auth.uid()));

create policy community_messages_select_members on public.community_messages
  for select to authenticated
  using (public.is_community_member(community_id, (select auth.uid())));
create policy community_messages_insert_members on public.community_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_community_member(community_id, (select auth.uid()))
  );

create policy post_communities_select on public.post_communities
  for select to authenticated using (true);
create policy post_communities_insert_own_post on public.post_communities
  for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
    and public.is_community_member(community_id, (select auth.uid()))
  );

create or replace function public.join_gym_community(p_gym_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_community_id uuid;
  v_gym_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select name into v_gym_name from public.gyms where id = p_gym_id;
  if v_gym_name is null then
    raise exception 'gym not found';
  end if;
  insert into public.communities (name, type, gym_id, created_by)
  values (v_gym_name, 'gym', p_gym_id, v_uid)
  on conflict (gym_id) do update set name = excluded.name
  returning id into v_community_id;
  insert into public.community_members (community_id, user_id)
  values (v_community_id, v_uid)
  on conflict do nothing;
  return v_community_id;
end;
$$;
revoke execute on function public.join_gym_community(uuid) from public, anon;
grant execute on function public.join_gym_community(uuid) to authenticated;

drop policy posts_select_friends on public.posts;
create policy posts_select_friends on public.posts
  for select to authenticated
  using (
    (user_id = (select auth.uid()))
    or (
      expires_at > now()
      and not is_blocked((select auth.uid()), user_id)
      and (
        are_friends((select auth.uid()), user_id)
        or exists (
          select 1
          from public.post_communities pc
          join public.community_members cm on cm.community_id = pc.community_id
          where pc.post_id = posts.id and cm.user_id = (select auth.uid())
        )
      )
    )
  );

drop policy posts_read_owner_or_friends on storage.objects;
create policy posts_read_owner_or_friends on storage.objects
  for select to authenticated
  using (
    bucket_id = 'posts'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or public.are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)
      or public.shares_community_post(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );
