-- Live-reaction selfies: a reaction is a front-camera photo, not just an emoji.
alter table public.post_reactions add column if not exists media_url text;
-- Selfie reactions have no emoji; relax the emoji check to allow null.
alter table public.post_reactions drop constraint if exists post_reactions_reaction_check;
alter table public.post_reactions
  add constraint post_reactions_reaction_check
  check (reaction is null or reaction = any (array['🔥','💪','😍','👀','💀']));

-- Private bucket for reaction selfies. Readable by anyone who can read the
-- underlying post's reactions (enforced app-side via signed URLs); writable
-- only into the reactor's own folder.
insert into storage.buckets (id, name, public)
values ('reactions', 'reactions', false)
on conflict (id) do nothing;

create policy reactions_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reactions' and (auth.uid())::text = (storage.foldername(name))[1]);
create policy reactions_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'reactions' and (auth.uid())::text = (storage.foldername(name))[1]);
create policy reactions_authenticated_read on storage.objects
  for select to authenticated
  using (bucket_id = 'reactions');
