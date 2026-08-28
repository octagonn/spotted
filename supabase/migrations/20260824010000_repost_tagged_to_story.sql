-- Repost a post you're TAGGED in to your own story (Ryan's ask) — the
-- Instagram pattern: the story shows the post's photo, credits the owner, and
-- taps through to the original.
--
-- cascade: if the original post is deleted, reshares of it disappear too —
-- a reshare is a pointer, not a copy the owner can no longer retract.
alter table public.stories
  add column if not exists shared_post_id uuid references public.posts(id) on delete cascade;

-- SECURITY DEFINER because the client can't do this honestly: the story row
-- must point at the post's RAW storage path, which the client never holds
-- (it only ever sees signed URLs). The function reads the path server-side
-- and enforces the rules in one place:
--   * you must be tagged in the post (owners just re-post normally)
--   * photos only — the story viewer renders images
--   * once per post per person while a reshare is still live
create or replace function public.repost_tagged_to_story(p_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_post record;
  v_story_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select id, user_id, media_url, media_type into v_post from posts where id = p_post_id;
  if v_post.id is null then
    raise exception 'post_not_found';
  end if;
  if not exists (select 1 from post_tags t where t.post_id = p_post_id and t.user_id = v_uid) then
    raise exception 'not_tagged';
  end if;
  if v_post.media_type <> 'image' or v_post.media_url is null then
    raise exception 'not_repostable';
  end if;
  if exists (
    select 1 from stories s
    where s.user_id = v_uid and s.shared_post_id = p_post_id and s.expires_at > now()
  ) then
    raise exception 'already_reposted';
  end if;
  insert into stories (user_id, media_url, shared_post_id)
  values (v_uid, v_post.media_url, p_post_id)
  returning id into v_story_id;
  return v_story_id;
end;
$function$;

revoke all on function public.repost_tagged_to_story(uuid) from public, anon;
grant execute on function public.repost_tagged_to_story(uuid) to authenticated;
