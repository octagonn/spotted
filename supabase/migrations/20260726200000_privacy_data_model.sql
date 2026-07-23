-- Privacy & Safety spec v1 — data model (§10) + age gate (§1).
alter table public.profiles
  add column if not exists is_private boolean not null default true,
  add column if not exists location_audience text not null default 'friends'
    check (location_audience in ('friends','close_friends','nobody')),
  add column if not exists quiet_checkin_default boolean not null default false,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','deactivated','pending_deletion')),
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists purge_scheduled_at timestamptz;

create table if not exists public.blocked_signups (
  id uuid primary key default gen_random_uuid(),
  email_hash text, device_hash text, attempted_dob date,
  created_at timestamptz not null default now(),
  retry_blocked_until timestamptz not null
);
create index if not exists blocked_signups_email_idx on public.blocked_signups (email_hash);
create index if not exists blocked_signups_device_idx on public.blocked_signups (device_hash);
alter table public.blocked_signups enable row level security;

create table if not exists public.restrictions (
  id uuid primary key default gen_random_uuid(),
  restrictor_id uuid not null references public.profiles(id) on delete cascade,
  restricted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (restrictor_id, restricted_id)
);
create index if not exists restrictions_restricted_idx on public.restrictions (restricted_id);
alter table public.restrictions enable row level security;
create policy restrictions_own on public.restrictions
  for all using (restrictor_id = auth.uid()) with check (restrictor_id = auth.uid());

create table if not exists public.close_friends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
alter table public.close_friends enable row level security;
create policy close_friends_own on public.close_friends
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  fulfilled_at timestamptz, download_expires_at timestamptz
);
create index if not exists data_export_user_idx on public.data_export_requests (user_id, requested_at desc);
alter table public.data_export_requests enable row level security;
create policy data_export_own on public.data_export_requests
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.geofence_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid,
  event_type text not null check (event_type in ('enter','exit','dwell_confirmed')),
  created_at timestamptz not null default now()
);
alter table public.geofence_events enable row level security;

alter table public.checkins
  add column if not exists is_quiet boolean not null default false,
  add column if not exists audience text not null default 'friends'
    check (audience in ('friends','close_friends','nobody')),
  add column if not exists presence_expires_at timestamptz;

-- Age gate (§1): server-side hash, 12-month retry block, no PII stored.
create or replace function public.check_age_gate(p_email text, p_device_id text, p_dob date)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_age integer;
  v_email_hash text := encode(digest(lower(trim(coalesce(p_email,''))), 'sha256'), 'hex');
  v_device_hash text := case when coalesce(p_device_id,'') = '' then null
                             else encode(digest(p_device_id, 'sha256'), 'hex') end;
begin
  if exists (select 1 from blocked_signups where retry_blocked_until > now()
      and (email_hash = v_email_hash or (v_device_hash is not null and device_hash = v_device_hash))) then
    return 'blocked';
  end if;
  v_age := extract(year from age(current_date, p_dob));
  if v_age < 13 then
    insert into blocked_signups (email_hash, device_hash, attempted_dob, retry_blocked_until)
    values (v_email_hash, v_device_hash, p_dob, now() + interval '12 months');
    return 'too_young';
  end if;
  return 'ok';
end; $$;
revoke all on function public.check_age_gate(text, text, date) from public;
grant execute on function public.check_age_gate(text, text, date) to anon, authenticated;

-- date_of_birth immutable (§1).
create or replace function public.guard_birthdate_immutable()
returns trigger language plpgsql as $$
begin
  if old.birth_date is not null and new.birth_date is distinct from old.birth_date then
    new.birth_date := old.birth_date;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_birthdate_immutable on public.profiles;
create trigger profiles_birthdate_immutable before update on public.profiles
  for each row execute function public.guard_birthdate_immutable();
