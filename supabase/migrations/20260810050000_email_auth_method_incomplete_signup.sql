-- Fix: email_auth_method misrouted incomplete signups to the password screen.
--
-- supabase.auth.signInWithOtp({ shouldCreateUser: true }) creates the auth user
-- (with a non-empty encrypted_password) the moment the FIRST code is requested —
-- before the user has verified their email or chosen a password. The old rule
-- classified any row with a password as "password", so a user who bailed
-- mid-onboarding and came back was sent to a password sign-in they could never
-- pass (they never set one), with no way to restart the OTP flow.
--
-- Only treat an account as a real password login when onboarding is actually
-- complete: email confirmed, a password present, AND our app's
-- password_setup_required flag no longer set. Everyone else resumes via OTP.
CREATE OR REPLACE FUNCTION public.email_auth_method(lookup_email text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when exists (
      select 1
      from auth.users
      where lower(email) = lower(trim(lookup_email))
        and deleted_at is null
        and email_confirmed_at is not null
        and coalesce(encrypted_password, '') <> ''
        and coalesce(raw_user_meta_data->>'password_setup_required', 'false') <> 'true'
    ) then 'password'
    else 'otp'
  end;
$function$;
