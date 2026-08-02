-- Versioned proof of the explicit Terms of Use + Privacy Policy checkbox shown
-- before account creation. The client cannot forge a record for another user.

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null check (char_length(terms_version) between 1 and 40),
  privacy_version text not null check (char_length(privacy_version) between 1 and 40),
  source text not null check (source in ('email', 'apple')),
  accepted_at timestamptz not null default now(),
  unique (user_id, terms_version, privacy_version)
);

create index if not exists legal_acceptances_user_accepted_idx
  on public.legal_acceptances (user_id, accepted_at desc);

alter table public.legal_acceptances enable row level security;

drop policy if exists legal_acceptances_select_own on public.legal_acceptances;
create policy legal_acceptances_select_own
  on public.legal_acceptances
  for select
  using (user_id = auth.uid());

revoke all on public.legal_acceptances from anon, authenticated;
grant select on public.legal_acceptances to authenticated;
grant all on public.legal_acceptances to service_role;

create or replace function public.record_legal_acceptance(
  p_terms_version text,
  p_privacy_version text,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(p_terms_version) not between 1 and 40
     or char_length(p_privacy_version) not between 1 and 40
     or p_source not in ('email', 'apple') then
    raise exception 'Invalid legal acceptance';
  end if;

  insert into public.legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    source
  )
  values (
    v_user_id,
    p_terms_version,
    p_privacy_version,
    p_source
  )
  on conflict (user_id, terms_version, privacy_version)
  do update set
    source = excluded.source,
    accepted_at = now();
end;
$$;

revoke all on function public.record_legal_acceptance(text, text, text)
  from public, anon;
grant execute on function public.record_legal_acceptance(text, text, text)
  to authenticated;

-- Keep notification operational/audit logs bounded. Notifications and their
-- delivery rows are removed after seven days; deduplication logs retain only
-- the last 90 days.
create or replace function public.notifications_cleanup_sweep()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notifications integer;
begin
  delete from public.notifications
  where created_at < now() - interval '7 days';
  get diagnostics v_notifications = row_count;

  delete from public.notification_log
  where sent_at < now() - interval '90 days';

  return v_notifications;
end;
$$;
