-- admin_overview() returned the moderation dashboard counts (open reports,
-- flagged media, watchlist size, pending deletions) to ANY caller, including
-- logged-out ones holding the public anon key that ships inside the app. It was
-- the only SECURITY DEFINER function in the schema that never checked its
-- caller — verified by calling the REST endpoint with just the anon key and
-- getting the real counts back.
--
-- Aggregate-only, so no user data leaked, but it is operational information
-- that has no business being public.
create or replace function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when not is_admin((select auth.uid())) then null::jsonb
    else jsonb_build_object(
      'open_reports', (select count(*) from reports where status is distinct from 'resolved' and status is distinct from 'dismissed'),
      'image_flags', (select count(*) from posts where moderation_status = 'flagged')
                   + (select count(*) from stories where moderation_status = 'flagged'),
      'text_flags', (select count(*) from text_moderation_flags where status = 'pending'),
      'watchlist', (select count(*) from watchlist),
      'pending_moderation', (select count(*) from moderation_jobs where status in ('pending','processing')),
      'deletions_pending', (select count(*) from profiles where account_status = 'pending_deletion')
    )
  end;
$function$;

-- Belt and braces: anon has no reason to reach this endpoint at all.
revoke execute on function public.admin_overview() from anon;
