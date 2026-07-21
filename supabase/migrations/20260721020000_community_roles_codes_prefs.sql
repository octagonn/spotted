-- Community spec 17/18/19: membership roles (multi-admin ready), per-member
-- notification prefs, and private-community invite codes.

alter table public.community_members
  add column if not exists role text not null default 'member'
  check (role in ('member', 'admin'));

update public.community_members m
set role = 'admin'
from public.communities c
where c.id = m.community_id and c.created_by = m.user_id and m.role <> 'admin';

create or replace function public.community_member_creator_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from communities c where c.id = new.community_id and c.created_by = new.user_id) then
    new.role := 'admin';
  end if;
  return new;
end $$;
drop trigger if exists community_member_creator_role on public.community_members;
create trigger community_member_creator_role
  before insert on public.community_members
  for each row execute function public.community_member_creator_role();

create table if not exists public.community_notification_prefs (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_notification_prefs enable row level security;
create policy "community_prefs_all_own" on public.community_notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.communities add column if not exists invite_code text unique;

create or replace function public.generate_community_code()
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
  from generate_series(1, 7);
$$;

update public.communities set invite_code = public.generate_community_code() where invite_code is null;

create or replace function public.community_invite_code(cid uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not exists (select 1 from community_members where community_id = cid and user_id = auth.uid()) then
    return null;
  end if;
  select invite_code into code from communities where id = cid;
  return code;
end $$;

create or replace function public.regenerate_community_invite_code(cid uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not exists (
    select 1 from community_members
    where community_id = cid and user_id = auth.uid() and role = 'admin'
  ) and not exists (
    select 1 from communities where id = cid and created_by = auth.uid()
  ) then
    raise exception 'not_admin';
  end if;
  loop
    code := public.generate_community_code();
    begin
      update communities set invite_code = code where id = cid;
      exit;
    exception when unique_violation then
    end;
  end loop;
  return code;
end $$;

create or replace function public.join_community_by_code(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from communities where invite_code = upper(trim(code));
  if cid is null then
    return null;
  end if;
  insert into community_members (community_id, user_id)
  values (cid, auth.uid())
  on conflict do nothing;
  delete from community_join_requests where community_id = cid and user_id = auth.uid();
  return cid;
end $$;
