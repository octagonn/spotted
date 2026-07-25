-- Post owners can delete any comment on their own post (moderate their space);
-- comment authors can still delete their own. Applied via MCP; mirrors deployed.
drop policy if exists post_comments_delete_self on public.post_comments;
create policy post_comments_delete_own_or_post_owner on public.post_comments
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_comments.post_id and p.user_id = auth.uid())
  );
