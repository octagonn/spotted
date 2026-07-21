-- Chat media read policy + posts.media_urls[] + follow removal (2026-07-19).
drop policy if exists messages_read_participants on storage.objects;
create policy messages_read_participants on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messages'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );
alter table public.posts add column if not exists media_urls text[];
drop trigger if exists follows_notify on public.follows;
drop function if exists public.notify_new_follower();
