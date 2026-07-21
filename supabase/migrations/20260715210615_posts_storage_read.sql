-- The posts bucket had INSERT/DELETE policies but no SELECT policy, so
-- createSignedUrl failed for every viewer and feed images rendered black.
-- Owners can read their own objects; friends can read each other's.

create policy posts_read_owner_or_friends on storage.objects
for select to authenticated
using (
  bucket_id = 'posts'
  and (
    (auth.uid())::text = (storage.foldername(name))[1]
    or public.are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
