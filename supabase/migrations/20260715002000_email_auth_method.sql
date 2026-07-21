-- Allows the unauthenticated email entry screen to choose the correct auth flow
-- without granting clients direct access to auth.users. Only Edge Functions using
-- the service role may execute this lookup.
create or replace function public.email_auth_method(lookup_email text)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select case
    when exists (
      select 1
      from auth.users
      where lower(email) = lower(trim(lookup_email))
        and deleted_at is null
        and coalesce(encrypted_password, '') <> ''
    ) then 'password'
    else 'otp'
  end;
$$;

revoke all on function public.email_auth_method(text) from public, anon, authenticated;
grant execute on function public.email_auth_method(text) to service_role;

comment on function public.email_auth_method(text) is
  'Returns password for password-enabled accounts and otp otherwise; service-role only.';
