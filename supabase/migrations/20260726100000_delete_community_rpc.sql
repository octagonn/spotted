-- Admin (creator) community deletion. SECURITY DEFINER because there is
-- deliberately NO DELETE policy on communities -- this RPC is the only path,
-- and it verifies ownership itself. All dependent tables (members, messages,
-- post links, join requests, invites, notification prefs, nudges) reference
-- communities with ON DELETE CASCADE, so one delete removes everything.
create or replace function public.delete_community(p_community uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from communities
    where id = p_community and created_by = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;
  delete from communities where id = p_community;
end;
$$;

revoke all on function public.delete_community(uuid) from public;
grant execute on function public.delete_community(uuid) to authenticated;
