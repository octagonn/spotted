-- New posts only appeared after backgrounding the app: nothing pushed feed
-- changes because `posts` was never in the realtime publication (only
-- messages + notifications were). Add posts, and community_messages — the
-- client has subscribed to the latter since the communities feature but the
-- events never flowed.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'community_messages') then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end $$;
