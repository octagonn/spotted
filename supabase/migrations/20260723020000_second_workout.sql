-- Workout-on-daily-post: a second workout attached to today's daily post
-- notifies the user's friends.
alter type notification_type add value if not exists 'second_workout';

create or replace function public.notify_second_workout(p_post uuid, p_name text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n integer := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from posts where id = p_post and user_id = uid) then
    raise exception 'not_post_owner';
  end if;
  with friends as (
    select case when f.user_id = uid then f.friend_id else f.user_id end as friend_id
    from friendships f
    where f.status = 'accepted' and (f.user_id = uid or f.friend_id = uid)
  )
  insert into notifications (recipient_id, actor_id, type, payload)
  select fr.friend_id, uid, 'second_workout',
         jsonb_build_object('post_id', p_post, 'workout_name', p_name)
  from friends fr;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.notify_second_workout(uuid, text) to authenticated;
