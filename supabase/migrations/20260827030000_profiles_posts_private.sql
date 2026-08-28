-- "Private posts": a public (discoverable) account whose content — posts,
-- comments/reactions on them, workouts, streaks, gym days, tags — is
-- friends-only. Profile card (name/bio/avatar) stays visible.
alter table public.profiles add column if not exists posts_private boolean not null default false;

create or replace function public.are_posts_public(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select not is_private and not posts_private and account_status = 'active' from profiles where id = p_user), false);
$$;
grant execute on function public.are_posts_public(uuid) to anon, authenticated;

create or replace function public.can_view_content(p_viewer uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_viewer = p_target
    or (not is_blocked(p_viewer, p_target)
        and (select account_status from profiles where id = p_target) = 'active'
        and (are_friends(p_viewer, p_target) or are_posts_public(p_target)));
$$;

create or replace function public.can_read_post(p_post_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p
    where p.id = p_post_id
      and (
        p.user_id = p_user_id
        or (not is_blocked(p_user_id, p.user_id)
          and (are_friends(p_user_id, p.user_id)
            or are_posts_public(p.user_id)
            or exists (
              select 1 from post_communities pc
              where pc.post_id = p.id and p.expires_at > now()
                and public.community_can(pc.community_id, p_user_id, 'view_posts'))))
      )
  );
$$;

drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts for select
  using (
    ((moderation_status <> 'flagged'::text) or (user_id = (select auth.uid())))
    and (
      (user_id = (select auth.uid()))
      or (
        (not is_blocked((select auth.uid()), user_id))
        and (
          are_friends((select auth.uid()), user_id)
          or are_posts_public(user_id)
          or exists (
            select 1 from post_communities pc
            where pc.post_id = posts.id
              and posts.expires_at > now()
              and public.community_can(pc.community_id, (select auth.uid()), 'view_posts')
          )
        )
      )
    )
  );

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
      and (poster is null or p.id = poster or are_friends(p.id, poster) or are_posts_public(poster))
  loop
    insert into notifications (recipient_id, actor_id, type, payload, push_status)
    values (m.id, new.user_id, 'mention',
      jsonb_build_object('post_id', new.post_id, 'comment_id', new.id, 'text', left(new.content, 140)),
      'pending');
  end loop;
  return new;
end $$;
