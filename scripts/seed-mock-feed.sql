-- Seeds mock friends + accepted friendships + recent posts so the feed has content.
-- Re-runnable: idempotent on usernames + email; replaces posts each run.

do $$
declare
  me_id uuid := '3e40136f-8aad-4781-9ce4-a99d6fd5b6be';
  mock_users jsonb := jsonb_build_array(
    jsonb_build_object('username','mia',     'display','Mia',      'email','mock+mia@spotted.app',     'avatar','https://i.pravatar.cc/300?img=47'),
    jsonb_build_object('username','jules',   'display','Jules',    'email','mock+jules@spotted.app',   'avatar','https://i.pravatar.cc/300?img=12'),
    jsonb_build_object('username','dre',     'display','Dre',      'email','mock+dre@spotted.app',     'avatar','https://i.pravatar.cc/300?img=68'),
    jsonb_build_object('username','sahar',   'display','Sahar',    'email','mock+sahar@spotted.app',   'avatar','https://i.pravatar.cc/300?img=32'),
    jsonb_build_object('username','rhea',    'display','Rhea',     'email','mock+rhea@spotted.app',    'avatar','https://i.pravatar.cc/300?img=23'),
    jsonb_build_object('username','marco',   'display','Marco',    'email','mock+marco@spotted.app',   'avatar','https://i.pravatar.cc/300?img=15'),
    jsonb_build_object('username','tess',    'display','Tess',     'email','mock+tess@spotted.app',    'avatar','https://i.pravatar.cc/300?img=49'),
    jsonb_build_object('username','vance',   'display','Vance',    'email','mock+vance@spotted.app',   'avatar','https://i.pravatar.cc/300?img=14')
  );
  rec record;
  uid uuid;
  picked_gym uuid;
  pic_url text;
  pic_urls text[] := array[
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&q=80',
    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
    'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80',
    'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=800&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&q=80',
    'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=800&q=80',
    'https://images.unsplash.com/photo-1652363722833-509b3aac287b?w=800&q=80',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=800&q=80'
  ];
  captions text[] := array[
    'PR day. Hit 315 for 5.',
    'Push session. Lats are screaming.',
    'Rest day = leg day apparently.',
    'Form check on the squat. Tag if I''m off.',
    'Cardio because I have to, not because I want to.',
    'Back & bi''s. Shoutout to the gym buddy who carried me.',
    'New split, new me.',
    'Quick 45 min before work.',
    'Empty gym at 6am hits different.',
    'Pump check.',
    'Three days deep into the new program.',
    'Gym → smoothie → nap.'
  ];
begin
  for rec in select * from jsonb_to_recordset(mock_users) as t(username text, display text, email text, avatar text)
  loop
    select id into uid from auth.users where email = rec.email;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values (
        uid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        rec.email,
        '$2a$10$mockmockmockmockmockmockmockmockmockmockmockmockmockmoxxx',
        now(),
        jsonb_build_object('provider','mock','providers',array['mock']),
        jsonb_build_object('mock', true),
        now(),
        now()
      );
    end if;

    insert into profiles (id, username, display_name, avatar_url, bio, timezone, created_at, updated_at)
    values (uid, rec.username, rec.display, rec.avatar, 'Demo account.', 'America/Los_Angeles', now(), now())
    on conflict (id) do update set
      username = excluded.username,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url;

    insert into friendships (user_id, friend_id, status, created_at)
    values (me_id, uid, 'accepted', now())
    on conflict (user_id, friend_id) do update set status = 'accepted';

    insert into streaks (user_id, current_streak, longest_streak, last_checkin_date, freeze_tokens)
    values (uid, (5 + (random()*15))::int, (10 + (random()*40))::int, current_date, 1)
    on conflict (user_id) do nothing;
  end loop;

  -- wipe any prior mock posts (anything authored by these mock accounts) so re-running gives a fresh window
  delete from posts
  where user_id in (
    select p.id from profiles p
    where p.username in ('mia','jules','dre','sahar','rhea','marco','tess','vance')
  );

  -- insert a fresh post per mock user, varying gym + media + caption
  for rec in select * from (
    select p.id as user_id, p.username,
           ((row_number() over (order by p.created_at)) - 1) as idx
    from profiles p
    where p.username in ('mia','jules','dre','sahar','rhea','marco','tess','vance')
  ) s
  loop
    select id into picked_gym from gyms
    where latitude between 33.7 and 34.3 and longitude between -118.7 and -117.5
    order by random() limit 1;

    pic_url := pic_urls[1 + (rec.idx % array_length(pic_urls, 1))];

    insert into posts (
      user_id, media_url, media_type, caption, gym_id, is_verified_at_gym,
      created_at, expires_at, replay_count, reply_count, is_daily_drop
    ) values (
      rec.user_id,
      pic_url,
      'image',
      captions[1 + (rec.idx % array_length(captions, 1))],
      picked_gym,
      true,
      now() - ((rec.idx * 47 + 12) || ' minutes')::interval,
      now() + ((20 - rec.idx) || ' hours')::interval,
      (random() * 6)::int,
      (random() * 4)::int,
      true
    );
  end loop;
end $$;

select count(*) as total_posts from posts where expires_at > now();
