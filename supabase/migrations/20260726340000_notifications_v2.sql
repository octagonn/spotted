-- Production push notification pipeline:
--   * Expo Push Tokens for iOS + Android (EAS owns APNs/FCM credentials)
--   * one installation token can belong to only one signed-in account
--   * complete per-category preferences and quiet hours
--   * durable send state, Expo tickets, receipts, retry, and token cleanup
--   * signed DB -> Edge Function webhooks without a committed API secret
--   * notification taps mark the matching activity opened/read

-- ---------------------------------------------------------------------------
-- Preferences: every notification_type is covered by one visible setting.

alter table public.notification_preferences
  add column if not exists push_enabled boolean not null default true,
  add column if not exists post_views_enabled boolean not null default false,
  add column if not exists follows_enabled boolean not null default true,
  add column if not exists tags_enabled boolean not null default true,
  add column if not exists communities_enabled boolean not null default true,
  add column if not exists friend_activity_enabled boolean not null default true,
  add column if not exists achievements_enabled boolean not null default true,
  add column if not exists quiet_hours_enabled boolean not null default true;

drop trigger if exists notification_preferences_updated on public.notification_preferences;
create trigger notification_preferences_updated
before update on public.notification_preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Installation tokens. Existing rows contain raw APNs tokens and must never be
-- mistaken for Expo tokens.

alter table public.device_tokens
  add column if not exists provider text,
  add column if not exists created_at timestamptz not null default now();

update public.device_tokens
set provider = 'apns'
where provider is null;

alter table public.device_tokens
  alter column provider set default 'expo',
  alter column provider set not null;

alter table public.device_tokens
  drop constraint if exists device_tokens_platform_check,
  drop constraint if exists device_tokens_provider_check;

alter table public.device_tokens
  add constraint device_tokens_platform_check check (platform in ('ios', 'android')),
  add constraint device_tokens_provider_check check (provider in ('expo', 'apns'));

-- A push token identifies an installation, not a user. Keep the most recently
-- seen owner if old account-switch rows duplicated the same token.
delete from public.device_tokens older
using public.device_tokens newer
where older.device_token = newer.device_token
  and (
    older.updated_at < newer.updated_at
    or (older.updated_at = newer.updated_at and older.ctid < newer.ctid)
  );

alter table public.device_tokens drop constraint if exists device_tokens_pkey;
alter table public.device_tokens
  add constraint device_tokens_pkey primary key (device_token);
create index if not exists device_tokens_user_idx
  on public.device_tokens (user_id, updated_at desc);

revoke insert, update, delete on public.device_tokens from authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'invalid_platform'; end if;
  if p_token !~ '^(Expo|Exponent)PushToken\[[^]]+\]$'
     or octet_length(p_token) > 512 then
    raise exception 'invalid_expo_push_token';
  end if;

  insert into public.device_tokens (
    user_id, device_token, platform, provider, updated_at
  )
  values (uid, p_token, p_platform, 'expo', now())
  on conflict (device_token) do update
  set user_id = excluded.user_id,
      platform = excluded.platform,
      provider = 'expo',
      updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.device_tokens
  where device_token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Durable state. Old notifications must not be replayed after deployment.

alter table public.notifications
  add column if not exists opened_at timestamptz,
  add column if not exists push_status text,
  add column if not exists push_attempts integer not null default 0,
  add column if not exists push_last_error text,
  add column if not exists push_next_attempt_at timestamptz,
  add column if not exists push_processed_at timestamptz;

update public.notifications
set push_status = 'suppressed',
    push_last_error = coalesce(push_last_error, 'created_before_expo_push_migration')
where push_status is null;

alter table public.notifications
  alter column push_status set default 'pending',
  alter column push_status set not null,
  alter column push_next_attempt_at set default now();

alter table public.notifications
  drop constraint if exists notifications_push_status_check,
  drop constraint if exists notifications_push_attempts_check;

alter table public.notifications
  add constraint notifications_push_status_check check (
    push_status in (
      'pending', 'processing', 'ticketed', 'delivered',
      'suppressed', 'no_token', 'retry', 'failed'
    )
  ),
  add constraint notifications_push_attempts_check check (
    push_attempts between 0 and 20
  );

create index if not exists notifications_push_retry_idx
  on public.notifications (push_next_attempt_at, created_at)
  where push_status in ('pending', 'retry', 'processing');

alter table public.notification_log
  add column if not exists notification_id uuid
    references public.notifications(id) on delete set null;
create index if not exists notification_log_notification_idx
  on public.notification_log (notification_id)
  where notification_id is not null;

create table if not exists public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_token text not null,
  ticket_id text,
  status text not null default 'sending' check (
    status in ('sending', 'ticketed', 'delivered', 'retry', 'failed', 'expired')
  ),
  attempts integer not null default 0 check (attempts between 0 and 20),
  last_error text,
  sent_at timestamptz,
  receipt_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, device_token)
);

create unique index if not exists push_deliveries_ticket_idx
  on public.push_deliveries (ticket_id)
  where ticket_id is not null;
create index if not exists push_deliveries_receipt_idx
  on public.push_deliveries (sent_at)
  where status = 'ticketed';

alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;
grant all on public.push_deliveries to service_role;

create or replace function public.mark_notification_opened(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed boolean;
begin
  update public.notifications
  set read = true,
      opened_at = coalesce(opened_at, now())
  where id = p_notification_id
    and recipient_id = auth.uid();
  changed := found;

  if changed then
    update public.notification_log
    set opened_at = coalesce(opened_at, now())
    where notification_id = p_notification_id
      and user_id = auth.uid();
  end if;
  return changed;
end;
$$;

revoke all on function public.mark_notification_opened(uuid) from public, anon;
grant execute on function public.mark_notification_opened(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- In-app activity and push eligibility are separate. The dispatch helper keeps
-- relationship blocking + dedupe, then always creates the activity. Push
-- preferences and quiet hours are enforced centrally by send-push.

create or replace function public.is_quiet_hours(p_prefs public.notification_preferences)
returns boolean
language sql
stable
set search_path = ''
as $$
  with t as (
    select (now() at time zone coalesce(nullif(p_prefs.timezone, ''), 'UTC'))::time as local_time
  )
  select p_prefs.quiet_hours_enabled
    and p_prefs.quiet_hours_start <> p_prefs.quiet_hours_end
    and case
      when p_prefs.quiet_hours_start < p_prefs.quiet_hours_end then
        (select local_time >= p_prefs.quiet_hours_start
             and local_time < p_prefs.quiet_hours_end from t)
      else
        (select local_time >= p_prefs.quiet_hours_start
             or local_time < p_prefs.quiet_hours_end from t)
    end;
$$;

create or replace function public.dispatch_notification(
  p_recipient uuid,
  p_actor uuid,
  p_type public.notification_type,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_notification_id uuid;
begin
  if p_recipient is null then return false; end if;
  if p_actor = p_recipient then return false; end if;

  if p_actor is not null and exists (
    select 1 from user_blocks b
    where (b.blocker_id = p_recipient and b.blocked_id = p_actor)
       or (b.blocker_id = p_actor and b.blocked_id = p_recipient)
  ) then
    return false;
  end if;

  begin
    insert into notification_log (user_id, type, dedupe_key)
    values (p_recipient, p_type::text, p_dedupe_key)
    returning id into v_log_id;
  exception when unique_violation then
    return false;
  end;

  insert into notifications (recipient_id, actor_id, type, payload)
  values (p_recipient, p_actor, p_type, coalesce(p_payload, '{}'::jsonb))
  returning id into v_notification_id;

  update notification_log
  set notification_id = v_notification_id
  where id = v_log_id;

  return true;
end;
$$;

revoke all on function public.dispatch_notification(
  uuid, uuid, public.notification_type, text, jsonb
) from public, anon;
grant execute on function public.dispatch_notification(
  uuid, uuid, public.notification_type, text, jsonb
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Signed DB webhooks. The random secret lives encrypted in Supabase Vault. It
-- is never committed and the Edge Function validates signatures through a
-- service-role-only RPC before reading any notification data.

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'push_webhook_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'push_webhook_secret',
      'HMAC secret for DB-to-send-push requests'
    );
  end if;
end;
$$;

create or replace function public.push_webhook_signature(p_action text)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select encode(
    extensions.hmac(p_action, decrypted_secret, 'sha256'),
    'hex'
  )
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  order by created_at desc
  limit 1;
$$;

create or replace function public.validate_push_webhook(
  p_action text,
  p_signature text
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    lower(p_signature) = public.push_webhook_signature(p_action),
    false
  );
$$;

revoke all on function public.push_webhook_signature(text)
  from public, anon, authenticated, service_role;
revoke all on function public.validate_push_webhook(text, text)
  from public, anon, authenticated;
grant execute on function public.validate_push_webhook(text, text)
  to service_role;

create or replace function public.enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  action text := 'notification:' || new.id::text;
begin
  perform net.http_post(
    url := 'https://nvywxqntsrlrmlrpfuub.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Spotted-Push-Signature', public.push_webhook_signature(action)
    ),
    body := jsonb_build_object('notification_id', new.id::text)
  );
  return new;
exception when others then
  -- The retry cron finds the still-pending row; push must never block activity.
  return new;
end;
$$;

revoke all on function public.enqueue_push() from public, anon, authenticated;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
after insert on public.notifications
for each row execute function public.enqueue_push();

create or replace function public.enqueue_push_worker(p_mode text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket text := to_char(clock_timestamp(), 'YYYYMMDDHH24MI');
  action text;
  request_id bigint;
begin
  if p_mode not in ('retry', 'receipts') then
    raise exception 'invalid_push_worker_mode';
  end if;
  action := p_mode || ':' || bucket;
  select net.http_post(
    url := 'https://nvywxqntsrlrmlrpfuub.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Spotted-Push-Signature', public.push_webhook_signature(action)
    ),
    body := jsonb_build_object('mode', p_mode, 'bucket', bucket)
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function public.enqueue_push_worker(text)
  from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('push-retry-sweep');
exception when others then
  null;
end;
$$;
do $$
begin
  perform cron.unschedule('push-receipt-sweep');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'push-retry-sweep',
  '*/2 * * * *',
  $$select public.enqueue_push_worker('retry')$$
);
select cron.schedule(
  'push-receipt-sweep',
  '*/15 * * * *',
  $$select public.enqueue_push_worker('receipts')$$
);
