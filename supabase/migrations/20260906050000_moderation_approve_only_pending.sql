-- The NSFW worker's "approved" branch overwrote ANY non-'reported' status,
-- including 'flagged' set moments earlier by flag_text() (caption/profanity
-- scanner). Real case 2026-09-06: a caption hit the blocked-terms list, the
-- post was hidden, then the image scan approved it 28 s later and the post
-- went live with the flagged caption while its text flag sat 'pending'.
-- An image approval may only move 'pending' → 'approved'; every other state
-- ('flagged' by text, 'reported', 'rejected') is someone else's decision.
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
        set moderation_status = case when moderation_status = 'pending' then 'approved' else moderation_status end,
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
      update stories set moderation_status = case when moderation_status = 'pending' then 'approved' else moderation_status end
        where id = v_story;
    end if;
  else
    v_action := 'no_target';
  end if;
  update moderation_jobs set status='done', processed_at=now(), result=p_scores, action=v_action where id=p_job;
  return v_action;
end $$;
