-- Images live ONLY in Cloudflare R2. The avatar blur pipeline used to hang off
-- a storage.objects trigger (Supabase bucket upload); avatars are now uploaded
-- straight to R2 and the profile row is the event source.
--
-- Data migration performed 2026-08-28 with the `r2-migrate-all` edge function
-- (copy → flip → verify → purge): 107 objects (avatars 52, posts 7,
-- messages 4, reactions 44) copied to R2 under the same keys with size
-- verification, every DB reference rewritten to "r2:<key>" (profiles.avatar_url
-- / avatar_blurred_url, communities.photo_url, posts.*, stories.*,
-- messages.media_url, post_reactions.media_url), then all four Supabase
-- Storage buckets emptied. `avatar-process` v7 reads/writes R2.
drop trigger if exists avatars_process on storage.objects;

create or replace function public.enqueue_avatar_process_r2()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare bearer text;
begin
  if new.avatar_url is null or new.avatar_url not like 'r2:%' then return new; end if;
  if tg_op = 'UPDATE' and new.avatar_url is not distinct from old.avatar_url then return new; end if;
  select (regexp_match(p.prosrc, 'Bearer ([A-Za-z0-9._-]+)'))[1] into bearer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'enqueue_avatar_process';
  if bearer is null then return new; end if;
  perform net.http_post(
    url := 'https://nvywxqntsrlrmlrpfuub.supabase.co/functions/v1/avatar-process',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || bearer, 'apikey', bearer),
    body := jsonb_build_object('userId', new.id::text)
  );
  return new;
exception when others then
  return new;
end $$;
revoke execute on function public.enqueue_avatar_process_r2() from public, anon, authenticated;
drop trigger if exists profiles_avatar_process_r2 on public.profiles;
create trigger profiles_avatar_process_r2 after insert or update of avatar_url on public.profiles
  for each row execute function public.enqueue_avatar_process_r2();

-- One-off ops token table used to authorize the migration function from a
-- dev machine with the anon key (row marked used afterwards).
create table if not exists public.ops_tokens (
  token uuid primary key default gen_random_uuid(),
  purpose text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.ops_tokens enable row level security;
