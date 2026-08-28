-- Post views should never notify (product decision): drop the trigger that
-- created a notification per view, its function, and every existing
-- post_view notification. The post_views TABLE stays — it still powers the
-- "who viewed" list; only the notifications go.
drop trigger if exists post_views_notify on public.post_views;
drop function if exists public.notify_post_view();
delete from public.notifications where type = 'post_view';
