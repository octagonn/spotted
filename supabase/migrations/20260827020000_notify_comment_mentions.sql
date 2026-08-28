-- Notify each @handle in a new comment (deduped, not the commenter, not the
-- post owner — they already get post_comment — and only people who can see
-- the post: friends of the poster, or anyone when the poster is public).
create or replace function public.notify_comment_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  poster uuid;
  m record;
begin
  select user_id into poster from posts where id = new.post_id;
  for m in
    select distinct p.id
    from regexp_matches(new.content, '(?:^|[^A-Za-z0-9_.])@([A-Za-z0-9_.]+)', 'g') as r(h)
    join profiles p on lower(p.username) = lower(regexp_replace(r.h[1], '\.+$', ''))
    where p.id <> new.user_id
      and (poster is null or p.id <> poster)
      and not is_blocked(p.id, new.user_id)
      and (poster is null or p.id = poster or are_friends(p.id, poster) or is_account_public(poster))
  loop
    insert into notifications (recipient_id, actor_id, type, payload, push_status)
    values (m.id, new.user_id, 'mention',
      jsonb_build_object('post_id', new.post_id, 'comment_id', new.id, 'text', left(new.content, 140)),
      'pending');
  end loop;
  return new;
end $$;
drop trigger if exists post_comments_notify_mentions on public.post_comments;
create trigger post_comments_notify_mentions after insert on public.post_comments
  for each row execute function public.notify_comment_mentions();
