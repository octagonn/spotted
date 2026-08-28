-- Communities hub v1: per-group mute + membership-gated "here now" presence.

-- Mute-per-group (spec: available immediately). Members update their own row
-- (community_members_update_self policy already exists).
alter table public.community_members add column if not exists muted boolean not null default false;

-- "Who's at this gym right now" for the hub hero. Membership-gated (the API
-- refuses non-members) and limited to community MEMBERS who are checked in
-- with a visible, non-quiet check-in — so joining a community never exposes
-- the location of someone who didn't opt into it.
create or replace function public.community_presence_now(p_community_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_gym uuid;
  v_count integer := 0;
  v_people jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('count', 0, 'people', '[]'::jsonb, 'locked', true);
  end if;
  if not exists (select 1 from community_members where community_id = p_community_id and user_id = v_uid) then
    return jsonb_build_object('count', 0, 'people', '[]'::jsonb, 'locked', true);
  end if;
  select gym_id into v_gym from communities where id = p_community_id;
  if v_gym is null then
    return jsonb_build_object('count', 0, 'people', '[]'::jsonb);
  end if;

  with here as (
    select distinct on (c.user_id) c.user_id, c.checked_in_at
    from checkins c
    where c.gym_id = v_gym
      and c.checked_out_at is null
      and coalesce(c.presence_expires_at, c.checked_in_at + interval '3 hours') > now()
      and coalesce(c.is_quiet, false) = false
      and coalesce(c.audience, 'friends') <> 'nobody'
      and c.user_id <> v_uid
      and exists (select 1 from community_members m where m.community_id = p_community_id and m.user_id = c.user_id)
    order by c.user_id, c.checked_in_at desc
  ),
  ranked as (
    select h.user_id, h.checked_in_at, row_number() over (order by h.checked_in_at desc) as rn from here h
  )
  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar_url', p.avatar_url)
                            order by r.checked_in_at desc) filter (where r.rn <= 3), '[]'::jsonb)
  into v_count, v_people
  from ranked r join profiles p on p.id = r.user_id;

  return jsonb_build_object('count', v_count, 'people', v_people);
end $$;
grant execute on function public.community_presence_now(uuid) to authenticated;
