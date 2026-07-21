-- 0006_security_hardening.sql
-- Addresses Supabase security advisor findings (2026-07-03):
--   1. Mutable search_path on trigger functions
--   2. SECURITY DEFINER functions executable by anon (and authenticated where not needed)
--   3. Broad SELECT policy on public avatars bucket allows listing all objects
--
-- Client-facing surface after this migration:
--   authenticated may EXECUTE: checkin, checkout            (called from the app)
--                              are_friends, can_read_post,
--                              is_blocked                   (referenced by RLS policies)
--   anon may EXECUTE: nothing
--   everything else runs only via triggers or the service role (edge functions)

-- 1. Pin search_path on trigger functions flagged by the linter
alter function public.set_updated_at() set search_path = public;
alter function public.bump_conversation_last_message() set search_path = public;
alter function public.bump_post_reply_count() set search_path = public;
alter function public.bump_post_replay_count() set search_path = public;

-- 2. Lock down SECURITY DEFINER execution
-- Trigger-only / service-role-only functions: no API-role execution at all
revoke execute on function public.create_profile_streak() from public, anon, authenticated;
revoke execute on function public.update_streak_on_checkin() from public, anon, authenticated;
revoke execute on function public.notify_gym_arrival() from public, anon, authenticated;
revoke execute on function public.notify_post_reaction() from public, anon, authenticated;
revoke execute on function public.notify_post_view() from public, anon, authenticated;
revoke execute on function public.get_friend_suggestions(uuid, integer) from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.bump_conversation_last_message() from public, anon, authenticated;
revoke execute on function public.bump_post_reply_count() from public, anon, authenticated;
revoke execute on function public.bump_post_replay_count() from public, anon, authenticated;

-- Client RPCs and RLS helpers: authenticated only, never anon
revoke execute on function public.checkin(uuid, double precision, double precision, boolean) from public, anon;
revoke execute on function public.checkout(uuid) from public, anon;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.can_read_post(uuid, uuid) from public, anon;
revoke execute on function public.is_blocked(uuid, uuid) from public, anon;

grant execute on function public.checkin(uuid, double precision, double precision, boolean) to authenticated;
grant execute on function public.checkout(uuid) to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.can_read_post(uuid, uuid) to authenticated;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- 3. Avatars bucket: the app reads avatars only via getPublicUrl (CDN path),
-- which does not require a SELECT policy. Dropping it removes the ability
-- for any client to enumerate every avatar object in the bucket.
drop policy if exists avatars_public_read on storage.objects;
