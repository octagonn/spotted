-- Moderation: never auto-delete, only hide for human review; fix admin reject.
--
-- Why (2026-09-11 audit of the NSFW pipeline):
--   * Every flagged post in the last 30 days (9) was a false positive from
--     NSFWJS MobileNetV2 — gym equipment, a blurry living room, a car
--     interior, hoodies. Nobody was working the review queue, so those users
--     saw "Under review" for weeks.
--   * The >=0.90 "rejected" branch was ALSO broken: `delete from
--     storage.objects` is blocked by Supabase ("Direct deletion from storage
--     tables is not allowed"), so the whole transaction aborted and the job
--     was re-claimed every poll — one post (a leg-curl machine, Hentai 0.955)
--     sat in 'pending' for 10 days across 2,628 attempts. That bug is the only
--     reason it wasn't permanently deleted.
--   * review_resolve(p_approve := false) had the same delete and would have
--     thrown 'not allowed' at an admin rejecting from Settings → Review.
--
-- New policy: any score that would have been 'rejected' is 'flagged' instead.
-- Flagged posts are already hidden from everyone but the owner (RLS) and land
-- in review_queue(); an admin rejects there via review_resolve(), which is now
-- the ONE place a post is deleted. Media lives on R2 ("r2:<key>" paths) and
-- only the service key may delete another user's objects, so the reject path
-- enqueues the keys in media_purge_queue and the moderation worker drains it.
--
-- The worker (moderation-worker/worker.js) now scores each class as the MIN
-- across MobileNetV2 + InceptionV3, which alone would have cleared all ten
-- false positives. Thresholds unchanged: nsfw >= 0.60 or Sexy >= 0.80 → flag.
-- Stories branch kept for the not-yet-dropped tables; same change applied.

create or replace function public.resolve_moderation_job(p_job uuid, p_scores jsonb)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_post uuid; v_story uuid;
  v_nsfw numeric := coalesce((p_scores->>'nsfw')::numeric, 0);
  v_sexy numeric := coalesce((p_scores->'breakdown'->>'Sexy')::numeric, 0);
  v_action text;
begin
  select post_id, story_id into v_post, v_story from moderation_jobs where id = p_job;
  if v_post is not null then
    if v_nsfw >= 0.60 or v_sexy >= 0.80 then
      v_action := 'flagged';
      update posts set moderation_status='flagged', moderation_score=p_scores, moderated_at=now() where id = v_post;
    else
      v_action := 'approved';
      update posts
        set moderation_status = case when moderation_status = 'pending' then 'approved' else moderation_status end,
            moderation_score = p_scores,
            moderated_at = now()
        where id = v_post;
    end if;
  elsif v_story is not null then
    if v_nsfw >= 0.60 or v_sexy >= 0.80 then
      v_action := 'flagged';
      update stories set moderation_status='flagged' where id = v_story;
    else
      v_action := 'approved';
      update stories set moderation_status = case when moderation_status = 'pending' then 'approved' else moderation_status end
        where id = v_story;
    end if;
  else
    v_action := 'no_target';
  end if;
  update moderation_jobs set status='done', processed_at=now(), result=p_scores, action=v_action where id=p_job;
  return v_action;
end $function$;

-- R2 keys awaiting deletion by the service-key worker. Service role only.
create table if not exists public.media_purge_queue (
  id bigserial primary key,
  key text not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.media_purge_queue enable row level security;
revoke all on public.media_purge_queue from anon, authenticated;

-- Admin reject: delete the row, queue the media. Approve path unchanged.
create or replace function public.review_resolve(p_post uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_paths text[];
begin
  if not is_admin(auth.uid()) then raise exception 'not_admin'; end if;
  if p_approve then
    update posts set moderation_status = 'approved', moderated_at = now() where id = p_post;
  else
    select array_remove(array[media_url, inset_url, thumbnail_url] || coalesce(media_urls, '{}'), null)
      into v_paths from posts where id = p_post;
    insert into media_purge_queue (key, reason)
      select substr(p, 4), 'review_reject:' || p_post::text
      from unnest(coalesce(v_paths, '{}')) as p
      where p like 'r2:%';
    delete from posts where id = p_post;
  end if;
end $function$;

-- Worker drain: pop up to p_limit keys. Service role only (no grant to users).
create or replace function public.claim_media_purges(p_limit int default 50)
returns table (id bigint, key text)
language sql
security definer
set search_path to 'public'
as $function$
  delete from media_purge_queue q
  where q.id in (select m.id from media_purge_queue m order by m.id limit p_limit)
  returning q.id, q.key;
$function$;
revoke execute on function public.claim_media_purges(int) from public, anon, authenticated;
