create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger posts_updated before update on posts for each row execute function set_updated_at();
create trigger conversations_updated before update on conversations for each row execute function set_updated_at();

create or replace function create_profile_streak() returns trigger as $$
begin
  insert into streaks (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
create trigger profiles_create_streak after insert on profiles for each row execute function create_profile_streak();

create or replace function bump_conversation_last_message() returns trigger as $$
begin
  update conversations set last_message_at = new.sent_at where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;
create trigger messages_bump_conv after insert on messages for each row execute function bump_conversation_last_message();

create or replace function update_streak_on_checkin() returns trigger as $$
declare
  last_date date;
  current int;
begin
  if not new.verified then
    return new;
  end if;
  insert into streaks (user_id) values (new.user_id) on conflict do nothing;
  select last_checkin_date, current_streak into last_date, current from streaks where user_id = new.user_id;
  if last_date = new.checked_in_at::date then
    return new;
  end if;
  if last_date = (new.checked_in_at::date - interval '1 day')::date then
    update streaks set current_streak = current + 1, longest_streak = greatest(longest_streak, current + 1), last_checkin_date = new.checked_in_at::date where user_id = new.user_id;
  else
    update streaks set current_streak = 1, longest_streak = greatest(longest_streak, 1), last_checkin_date = new.checked_in_at::date where user_id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
create trigger checkins_update_streak after insert on checkins for each row execute function update_streak_on_checkin();

create or replace function notify_post_view() returns trigger as $$
declare
  poster uuid;
begin
  select user_id into poster from posts where id = new.post_id;
  if poster = new.viewer_id then
    return new;
  end if;
  insert into notifications (recipient_id, actor_id, type, payload)
  values (poster, new.viewer_id, 'post_view', jsonb_build_object('post_id', new.post_id));
  return new;
end;
$$ language plpgsql security definer set search_path = public;
create trigger post_views_notify after insert on post_views for each row execute function notify_post_view();

create or replace function notify_post_reaction() returns trigger as $$
declare
  poster uuid;
begin
  select user_id into poster from posts where id = new.post_id;
  if poster = new.user_id then
    return new;
  end if;
  insert into notifications (recipient_id, actor_id, type, payload)
  values (poster, new.user_id, 'post_reaction', jsonb_build_object('post_id', new.post_id, 'reaction', new.reaction));
  return new;
end;
$$ language plpgsql security definer set search_path = public;
create trigger post_reactions_notify after insert on post_reactions for each row execute function notify_post_reaction();

create or replace function notify_gym_arrival() returns trigger as $$
begin
  insert into notifications (recipient_id, actor_id, type, payload)
  select
    case when f.user_id = new.user_id then f.friend_id else f.user_id end,
    new.user_id,
    'gym_arrival_friend',
    jsonb_build_object('gym_id', new.gym_id, 'checkin_id', new.id)
  from friendships f
  join profiles recipient on recipient.id = case when f.user_id = new.user_id then f.friend_id else f.user_id end
  where f.status = 'accepted'
    and recipient.arrival_notifs_enabled = true
    and not exists (
      select 1 from notifications n
      where n.recipient_id = recipient.id
        and n.actor_id = new.user_id
        and n.type = 'gym_arrival_friend'
        and n.created_at > now() - interval '4 hours'
    );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
create trigger checkins_notify_arrival after insert on checkins for each row execute function notify_gym_arrival();

create or replace function checkin(p_gym_id uuid, p_latitude double precision, p_longitude double precision, p_verified boolean default true) returns uuid as $$
declare
  gym gyms%rowtype;
  active_id uuid;
  created_id uuid;
  verified_distance boolean;
begin
  select * into gym from gyms where id = p_gym_id;
  if gym.id is null then
    raise exception 'gym_not_found';
  end if;
  verified_distance := earth_distance(ll_to_earth(p_latitude, p_longitude), ll_to_earth(gym.latitude, gym.longitude)) <= gym.geofence_radius_meters;
  select id into active_id from checkins where user_id = auth.uid() and gym_id = p_gym_id and checked_out_at is null order by checked_in_at desc limit 1;
  if active_id is not null then
    return active_id;
  end if;
  insert into checkins (user_id, gym_id, source, verified)
  values (auth.uid(), p_gym_id, 'geofence', p_verified and verified_distance)
  returning id into created_id;
  return created_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function checkout(p_checkin_id uuid) returns void as $$
begin
  update checkins set checked_out_at = now() where id = p_checkin_id and user_id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

create or replace function get_friend_suggestions(p_user_id uuid, p_limit int default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  mutual_friends_count bigint
) as $$
declare
  caller_home_gym uuid;
begin
  select home_gym_id into caller_home_gym from profiles where profiles.id = p_user_id;
  return query
  with caller_friends as (
    select case when f.user_id = p_user_id then f.friend_id else f.user_id end as friend_id
    from friendships f
    where f.status = 'accepted'
      and p_user_id in (f.user_id, f.friend_id)
  ),
  candidate_friends as (
    select
      p.id as candidate_id,
      case when f.user_id = p.id then f.friend_id else f.user_id end as friend_id
    from profiles p
    join friendships f on f.status = 'accepted' and p.id in (f.user_id, f.friend_id)
  )
  select p.id, p.username, p.display_name, p.avatar_url, count(cf.friend_id) filter (where cf.friend_id in (select friend_id from caller_friends)) as mutual_friends_count
  from profiles p
  left join candidate_friends cf on cf.candidate_id = p.id
  where p.id <> p_user_id
    and p.home_gym_id = caller_home_gym
    and p.discoverable = true
    and not exists (
      select 1 from friendships f
      where (f.user_id = p_user_id and f.friend_id = p.id)
         or (f.friend_id = p_user_id and f.user_id = p.id)
    )
  group by p.id
  order by mutual_friends_count desc, p.gym_score desc, p.created_at desc
  limit p_limit;
end;
$$ language plpgsql security definer set search_path = public;
