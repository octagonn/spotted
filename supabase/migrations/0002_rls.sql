create or replace function are_friends(a uuid, b uuid) returns boolean as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.user_id = a and f.friend_id = b) or (f.friend_id = a and f.user_id = b))
  );
$$ language sql stable security definer set search_path = public;

create or replace function is_blocked(a uuid, b uuid) returns boolean as $$
  select exists (
    select 1 from friendships f
    where f.status = 'blocked'
      and ((f.user_id = a and f.friend_id = b) or (f.friend_id = a and f.user_id = b))
  );
$$ language sql stable security definer set search_path = public;

create or replace function can_read_post(p_post_id uuid, p_user_id uuid) returns boolean as $$
  select exists (
    select 1 from posts p
    where p.id = p_post_id
      and p.expires_at > now()
      and (p.user_id = p_user_id or are_friends(p.user_id, p_user_id))
      and not is_blocked(p.user_id, p_user_id)
  );
$$ language sql stable security definer set search_path = public;

alter table gyms enable row level security;
create policy gyms_select_all on gyms for select using (true);
create policy gyms_admin_write on gyms for all using ((auth.jwt() ->> 'app_role') = 'admin') with check ((auth.jwt() ->> 'app_role') = 'admin');

alter table profiles enable row level security;
create policy profiles_select_visible on profiles for select using (not is_blocked(id, auth.uid()));
create policy profiles_insert_self on profiles for insert with check (auth.uid() = id);
create policy profiles_update_self on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

alter table workout_schedule enable row level security;
create policy schedule_select_visibility on workout_schedule for select using (
  user_id = auth.uid()
  or exists (
    select 1 from profiles p
    where p.id = workout_schedule.user_id
      and not is_blocked(p.id, auth.uid())
      and (
        p.schedule_visibility = 'public'
        or (p.schedule_visibility = 'friends' and are_friends(auth.uid(), p.id))
      )
  )
);
create policy schedule_write_self on workout_schedule for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table checkins enable row level security;
create policy checkins_select_self_or_friends on checkins for select using (user_id = auth.uid() or are_friends(auth.uid(), user_id));
create policy checkins_insert_self on checkins for insert with check (user_id = auth.uid());
create policy checkins_update_self on checkins for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table streaks enable row level security;
create policy streaks_select_self_or_friends on streaks for select using (user_id = auth.uid() or are_friends(auth.uid(), user_id));
create policy streaks_write_self on streaks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table posts enable row level security;
create policy posts_select_friends on posts for select using (
  user_id = auth.uid()
  or (expires_at > now() and are_friends(auth.uid(), user_id) and not is_blocked(auth.uid(), user_id))
);
create policy posts_insert_self on posts for insert with check (user_id = auth.uid());
create policy posts_update_self_saved_only on posts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy posts_delete_self on posts for delete using (user_id = auth.uid());

alter table post_views enable row level security;
create policy post_views_select_owner_or_self on post_views for select using (
  viewer_id = auth.uid()
  or exists (select 1 from posts where posts.id = post_views.post_id and posts.user_id = auth.uid())
);
create policy post_views_insert_self on post_views for insert with check (viewer_id = auth.uid() and can_read_post(post_id, auth.uid()));

alter table post_reactions enable row level security;
create policy post_reactions_read_if_post_readable on post_reactions for select using (can_read_post(post_id, auth.uid()));
create policy post_reactions_insert_self on post_reactions for insert with check (user_id = auth.uid() and can_read_post(post_id, auth.uid()));
create policy post_reactions_update_self on post_reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy post_reactions_delete_self on post_reactions for delete using (user_id = auth.uid());

alter table friendships enable row level security;
create policy friendships_read_involved on friendships for select using (auth.uid() in (user_id, friend_id));
create policy friendships_insert_request_self on friendships for insert with check (user_id = auth.uid());
create policy friendships_update_involved on friendships for update using (auth.uid() in (user_id, friend_id)) with check (auth.uid() in (user_id, friend_id));
create policy friendships_delete_involved on friendships for delete using (auth.uid() in (user_id, friend_id));

alter table conversations enable row level security;
create policy conversations_participants on conversations for all using (auth.uid() in (participant_a, participant_b)) with check (auth.uid() in (participant_a, participant_b));

alter table messages enable row level security;
create policy messages_participants on messages for all using (
  exists (
    select 1 from conversations c
    where c.id = conversation_id
      and auth.uid() in (c.participant_a, c.participant_b)
  )
) with check (
  exists (
    select 1 from conversations c
    where c.id = conversation_id
      and auth.uid() in (c.participant_a, c.participant_b)
  )
);

alter table skip_events enable row level security;
create policy skip_events_select_self_or_friends on skip_events for select using (user_id = auth.uid() or are_friends(auth.uid(), user_id));
create policy skip_events_insert_self on skip_events for insert with check (user_id = auth.uid());

alter table notifications enable row level security;
create policy notifications_recipient_select on notifications for select using (recipient_id = auth.uid());
create policy notifications_recipient_update on notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

alter table device_tokens enable row level security;
create policy device_tokens_self on device_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy avatars_public_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_owner_write on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy avatars_owner_update on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy avatars_owner_delete on storage.objects for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy posts_owner_write on storage.objects for insert with check (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);
create policy posts_owner_delete on storage.objects for delete using (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);
create policy messages_owner_write on storage.objects for insert with check (bucket_id = 'messages' and auth.uid()::text = (storage.foldername(name))[1]);
create policy messages_owner_delete on storage.objects for delete using (bucket_id = 'messages' and auth.uid()::text = (storage.foldername(name))[1]);
