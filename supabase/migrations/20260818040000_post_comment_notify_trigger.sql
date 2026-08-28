-- Comments never notified the post owner at all — the notification center
-- had no "commented on your post" row to show. Inbox-only for now:
-- push_status 'suppressed' makes the push webhook's early-return skip it, so
-- the push pipeline (whose templates don't know this type) is untouched.
create or replace function public.notify_post_comment() returns trigger as $$
declare
  poster uuid;
begin
  select user_id into poster from posts where id = new.post_id;
  if poster is null or poster = new.user_id then
    return new;
  end if;
  insert into notifications (recipient_id, actor_id, type, payload, push_status)
  values (poster, new.user_id, 'post_comment', jsonb_build_object('post_id', new.post_id, 'comment_id', new.id), 'suppressed');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists post_comments_notify on public.post_comments;
create trigger post_comments_notify after insert on public.post_comments
  for each row execute function notify_post_comment();
