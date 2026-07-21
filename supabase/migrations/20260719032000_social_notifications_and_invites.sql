-- Friend request / accept notifications (push delivery already fires on
-- notifications insert via the pg_net trigger).
create or replace function public.notify_friend_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into notifications (recipient_id, actor_id, type)
    values (new.friend_id, new.user_id, 'friend_request');
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into notifications (recipient_id, actor_id, type)
    values (new.user_id, new.friend_id, 'friend_accepted');
  end if;
  return new;
end $$;
drop trigger if exists friendships_notify on public.friendships;
create trigger friendships_notify after insert or update on public.friendships
  for each row execute function public.notify_friend_event();

-- New follower notification.
create or replace function public.notify_new_follower() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.follower_id <> new.followee_id then
    insert into notifications (recipient_id, actor_id, type)
    values (new.followee_id, new.follower_id, 'new_follower');
  end if;
  return new;
end $$;
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_new_follower();

-- Community invites: members invite friends; accepting joins directly (even
-- private communities — the invite is the approval).
create table if not exists public.community_invites (
  community_id uuid not null references public.communities(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, invitee_id)
);
alter table public.community_invites enable row level security;

drop policy if exists ci_insert_member on public.community_invites;
create policy ci_insert_member on public.community_invites
  for insert to authenticated
  with check (
    inviter_id = (select auth.uid())
    and invitee_id <> (select auth.uid())
    and exists (
      select 1 from public.community_members m
      where m.community_id = community_invites.community_id and m.user_id = (select auth.uid())
    )
  );
drop policy if exists ci_select_involved on public.community_invites;
create policy ci_select_involved on public.community_invites
  for select to authenticated
  using (invitee_id = (select auth.uid()) or inviter_id = (select auth.uid()));
drop policy if exists ci_delete_involved on public.community_invites;
create policy ci_delete_involved on public.community_invites
  for delete to authenticated
  using (invitee_id = (select auth.uid()) or inviter_id = (select auth.uid()));
create index if not exists community_invites_invitee_idx on public.community_invites(invitee_id);

-- Invite notification with the community name in the payload.
create or replace function public.notify_community_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from communities where id = new.community_id;
  insert into notifications (recipient_id, actor_id, type, payload)
  values (new.invitee_id, new.inviter_id, 'community_invite',
          jsonb_build_object('community_id', new.community_id, 'community_name', coalesce(v_name, 'a community')));
  return new;
end $$;
drop trigger if exists community_invites_notify on public.community_invites;
create trigger community_invites_notify after insert on public.community_invites
  for each row execute function public.notify_community_invite();

-- Accept/decline an invite. Accept joins the community (SECURITY DEFINER
-- bypasses the public-only self-join policy for private communities).
create or replace function public.respond_community_invite(p_community_id uuid, p_accept boolean)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (
    select 1 from community_invites
    where community_id = p_community_id and invitee_id = auth.uid()
  ) then
    raise exception 'no_invite';
  end if;
  if p_accept then
    insert into community_members (community_id, user_id)
    values (p_community_id, auth.uid())
    on conflict do nothing;
    delete from community_join_requests
    where community_id = p_community_id and user_id = auth.uid();
  end if;
  delete from community_invites
  where community_id = p_community_id and invitee_id = auth.uid();
end $$;
revoke execute on function public.respond_community_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_community_invite(uuid, boolean) to authenticated;
