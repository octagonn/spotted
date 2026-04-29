begin;
select plan(8);

select policies_are('public', 'friendships', array['friendships_read_involved', 'friendships_insert_request_self', 'friendships_update_involved', 'friendships_delete_involved']);
select policies_are('public', 'conversations', array['conversations_participants']);
select policies_are('public', 'messages', array['messages_participants']);
select policies_are('public', 'checkins', array['checkins_select_self_or_friends', 'checkins_insert_self', 'checkins_update_self']);
select policies_are('public', 'streaks', array['streaks_select_self_or_friends', 'streaks_write_self']);
select policies_are('public', 'skip_events', array['skip_events_select_self_or_friends', 'skip_events_insert_self']);
select policies_are('public', 'notifications', array['notifications_recipient_select', 'notifications_recipient_update']);
select policies_are('public', 'device_tokens', array['device_tokens_self']);

select * from finish();
rollback;
