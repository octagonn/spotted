-- Communities tab revamp: read tracking for unread dots, crew nudges with a
-- server-enforced 24h rate limit, and friend waves from the live-presence strip.

-- 1) Unread dots: when did this member last open the community?
alter table public.community_members
  add column if not exists last_read_at timestamptz not null default now();

-- 2) Crew nudges — one row per sent nudge (the rate-limit ledger).
create table if not exists public.community_nudges (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists community_nudges_rate_idx
  on public.community_nudges (community_id, user_id, created_at desc);

alter table public.community_nudges enable row level security;

-- Members can see their community's nudge history (drives "Nudged" state).
drop policy if exists community_nudges_select on public.community_nudges;
create policy community_nudges_select on public.community_nudges
  for select using (
    exists (
      select 1 from public.community_members m
      where m.community_id = community_nudges.community_id
        and m.user_id = auth.uid()
    )
  );
-- Inserts happen only through the definer RPC below (no direct insert policy).

-- 3) Nudge RPC: membership check + 24h rate limit + notify quiet members.
create or replace function public.nudge_community(cid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cname text;
  notified integer := 0;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from community_members where community_id = cid and user_id = uid
  ) then
    raise exception 'not_a_member';
  end if;
  -- Server-enforced: one nudge per member per crew per 24h.
  if exists (
    select 1 from community_nudges
    where community_id = cid and user_id = uid
      and created_at > now() - interval '24 hours'
  ) then
    raise exception 'nudge_rate_limited';
  end if;

  select name into cname from communities where id = cid;
  insert into community_nudges (community_id, user_id) values (cid, uid);

  -- Push goes to INACTIVE members only (no message in the last 3 days),
  -- never back to the nudger.
  with quiet_members as (
    select m.user_id
    from community_members m
    where m.community_id = cid
      and m.user_id <> uid
      and not exists (
        select 1 from community_messages msg
        where msg.community_id = cid
          and msg.sender_id = m.user_id
          and msg.sent_at > now() - interval '3 days'
      )
  )
  insert into notifications (recipient_id, actor_id, type, payload)
  select q.user_id, uid, 'community_nudge',
         jsonb_build_object('communityId', cid, 'communityName', cname)
  from quiet_members q;
  get diagnostics notified = row_count;
  return notified;
end;
$$;

-- 4) Wave RPC: friends-only, one wave per target per 4h.
create or replace function public.wave_at_friend(target uuid, gym_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.user_id = uid and f.friend_id = target)
        or (f.user_id = target and f.friend_id = uid))
  ) then
    raise exception 'not_friends';
  end if;
  if exists (
    select 1 from notifications n
    where n.type = 'wave' and n.actor_id = uid and n.recipient_id = target
      and n.created_at > now() - interval '4 hours'
  ) then
    return; -- silently ignore repeat waves inside the window
  end if;
  insert into notifications (recipient_id, actor_id, type, payload)
  values (target, uid, 'wave', jsonb_build_object('gymName', gym_name));
end;
$$;

grant execute on function public.nudge_community(uuid) to authenticated;
grant execute on function public.wave_at_friend(uuid, text) to authenticated;

-- 5) Members may update their own membership row (last_read_at bumps).
drop policy if exists community_members_update_self on public.community_members;
create policy community_members_update_self on public.community_members
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Guard: RLS-authenticated self-updates can't touch identity or role.
-- Service-role / SECURITY DEFINER paths stay free to manage roles.
create or replace function public.community_members_guard_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and old.user_id = auth.uid() then
    new.role := old.role;
    new.joined_at := old.joined_at;
    new.community_id := old.community_id;
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists community_members_guard_update on public.community_members;
create trigger community_members_guard_update
  before update on public.community_members
  for each row execute function public.community_members_guard_update();
