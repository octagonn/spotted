-- Two friend-list privacy gaps:
--  1. user_friends(uid) was SECURITY DEFINER with no checks — anyone could
--     enumerate ANY user's friends, including private profiles.
--  2. New opt-in setting: friends_list_hidden hides your friends list from
--     everyone (including friends). Default off.
alter table public.profiles add column if not exists friends_list_hidden boolean not null default false;

create or replace function public.user_friends(uid uuid)
returns setof profiles
language sql
stable security definer
set search_path to 'public'
as $function$
  select p.* from profiles p
  where p.id in (
    select case when f.user_id = uid then f.friend_id else f.user_id end
    from friendships f
    where f.status = 'accepted' and (f.user_id = uid or f.friend_id = uid)
  )
  -- Own list: always visible. Others' lists: hidden if the owner opted out,
  -- if the owner is private and you aren't friends (IG model), or if either
  -- side blocked the other.
  and (
    uid = auth.uid()
    or (
      not coalesce((select fl.friends_list_hidden from profiles fl where fl.id = uid), false)
      and not is_blocked(auth.uid(), uid)
      and (
        coalesce((select pr.is_private from profiles pr where pr.id = uid), false) = false
        or are_friends(auth.uid(), uid)
      )
    )
  )
$function$;
