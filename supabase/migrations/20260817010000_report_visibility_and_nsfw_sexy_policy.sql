-- ── 1) Reporting no longer hides the post ────────────────────────────────────
-- flag_post_from_report used to set moderation_status='flagged', which RLS
-- hides from everyone except the owner — one report silently removed the post
-- from every feed. A report now marks the post 'reported': fully visible
-- (posts_select_visible only hides 'flagged'), queued for human review, and
-- only a reviewer's decision — or the NSFW auto-flag — changes visibility.
create or replace function public.flag_post_from_report(p_post uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update posts set moderation_status = 'reported'
    where id = p_post and moderation_status in ('pending', 'approved');
end $$;

-- ── 2) Review queue covers both states ───────────────────────────────────────
create or replace function public.review_queue()
returns table(post_id uuid, user_id uuid, media_url text, inset_url text, moderation_score jsonb, created_at timestamp with time zone)
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then raise exception 'not_admin'; end if;
  return query
    select p.id, p.user_id, p.media_url, p.inset_url, p.moderation_score, p.created_at
    from posts p where p.moderation_status in ('flagged', 'reported')
    order by p.created_at desc limit 200;
end $$;

-- ── 3) NSFW policy: nudity lives under "Sexy", not just Porn+Hentai ──────────
-- NSFWJS files real-photo nudity under the Sexy class (a tested nude scored
-- Sexy 0.92 with Porn 0.01 and sailed through the old Porn+Hentai-only
-- score). Normal gym content observed in production scores Sexy < 0.1, so a
-- 0.80 Sexy threshold flags nudity for review without touching sports-bra
-- shots. Worker approvals no longer clobber a 'reported' marker either.
create or replace function public.resolve_moderation_job(p_job uuid, p_scores jsonb)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_post uuid; v_story uuid; v_paths text[];
  v_nsfw numeric := coalesce((p_scores->>'nsfw')::numeric, 0);
  v_sexy numeric := coalesce((p_scores->'breakdown'->>'Sexy')::numeric, 0);
  v_action text;
begin
  select post_id, story_id, paths into v_post, v_story, v_paths from moderation_jobs where id = p_job;
  if v_post is not null then
    if v_nsfw >= 0.90 then
      v_action := 'rejected';
      delete from storage.objects where bucket_id = 'posts' and name = any(v_paths);
      delete from posts where id = v_post;
    elsif v_nsfw >= 0.60 or v_sexy >= 0.80 then
      v_action := 'flagged';
      update posts set moderation_status='flagged', moderation_score=p_scores, moderated_at=now() where id = v_post;
    else
      v_action := 'approved';
      update posts
        set moderation_status = case when moderation_status = 'reported' then 'reported' else 'approved' end,
            moderation_score = p_scores,
            moderated_at = now()
        where id = v_post;
    end if;
  elsif v_story is not null then
    if v_nsfw >= 0.90 then
      v_action := 'rejected';
      delete from storage.objects where bucket_id = 'posts' and name = any(v_paths);
      delete from stories where id = v_story;
    elsif v_nsfw >= 0.60 or v_sexy >= 0.80 then
      v_action := 'flagged';
      update stories set moderation_status='flagged' where id = v_story;
    else
      v_action := 'approved';
      update stories set moderation_status='approved' where id = v_story;
    end if;
  else
    v_action := 'no_target';
  end if;
  update moderation_jobs set status='done', processed_at=now(), result=p_scores, action=v_action where id=p_job;
  return v_action;
end $$;
