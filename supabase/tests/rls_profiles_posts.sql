begin;
select plan(8);

select has_table('public', 'profiles', 'profiles table exists');
select policies_are('public', 'profiles', array['profiles_select_visible', 'profiles_insert_self', 'profiles_update_self']);
select policies_are('public', 'posts', array['posts_select_friends', 'posts_insert_self', 'posts_update_self_saved_only', 'posts_delete_self']);
select policies_are('public', 'post_views', array['post_views_select_owner_or_self', 'post_views_insert_self']);
select policies_are('public', 'workout_schedule', array['schedule_select_visibility', 'schedule_write_self']);
select col_is_fk('public', 'posts', 'user_id', 'posts user_id is constrained');
select has_function('public', 'can_read_post', array['uuid','uuid'], 'post read function exists');
select has_function('public', 'get_friend_suggestions', array['uuid','integer'], 'suggestions function exists');

select * from finish();
rollback;
