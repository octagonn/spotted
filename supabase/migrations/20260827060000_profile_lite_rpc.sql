-- Minimal public identity for ids the caller can't otherwise read (e.g. the
-- actor of an old notification after a block). Name/handle/avatar only.
create or replace function public.profile_lite(p_ids uuid[])
returns table(id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from profiles p
  where p.id = any(p_ids)
  limit 200;
$$;
grant execute on function public.profile_lite(uuid[]) to authenticated;
