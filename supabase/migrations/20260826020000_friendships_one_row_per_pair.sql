-- Beta: "if you add someone they can also add you, and if you add each other
-- they show up twice on your friends list." friendships rows are directional
-- (PK user_id, friend_id) and nothing stopped A->B AND B->A from coexisting.
--
-- Rule now: exactly one row per pair. Sending a request to someone who already
-- requested you ACCEPTS their request instead of creating a second one.

-- 1. Collapse the existing duplicate pair(s): keep the older row.
delete from public.friendships f
using public.friendships r
where r.user_id = f.friend_id
  and r.friend_id = f.user_id
  and r.created_at < f.created_at;

-- 2. Reverse-request collapse. BEFORE INSERT: if the other direction already
--    exists, act on it and skip this insert (return null).
create or replace function public.friendships_collapse_reverse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reverse public.friendships%rowtype;
begin
  select * into v_reverse
  from friendships
  where user_id = new.friend_id and friend_id = new.user_id;
  if not found then
    return new;
  end if;
  if v_reverse.status = 'pending' then
    -- They already asked you: this "add" is an accept.
    update friendships set status = 'accepted'
    where user_id = v_reverse.user_id and friend_id = v_reverse.friend_id;
  end if;
  -- accepted (already friends) / blocked: nothing to add either way.
  return null;
end $$;

drop trigger if exists friendships_collapse_reverse on public.friendships;
create trigger friendships_collapse_reverse
  before insert on public.friendships
  for each row execute function public.friendships_collapse_reverse();

-- 3. Hard guarantee: one row per unordered pair.
create unique index if not exists friendships_pair_unique
  on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));
