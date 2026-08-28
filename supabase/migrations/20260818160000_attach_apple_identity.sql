-- Attach a VERIFIED Apple identity to an existing account.
--
-- Called only by the link-apple-identity edge function, which cryptographically
-- verifies the Apple identity token (Apple JWKS signature + issuer + audience +
-- expiry) before calling. This function does the database half: it never sees
-- or trusts a raw token, only the already-verified Apple subject id.
--
-- Why direct identity insertion: Supabase's supported manual-link path uses
-- Apple's WEB flow, which requires a Services ID; this project is configured
-- with the iOS bundle ID, so appleid.apple.com refuses with "Sign Up Not
-- Completed". Linking natively also lets Hide My Email work, since the email
-- never has to match.
create or replace function public.attach_apple_identity(
  p_user uuid,
  p_sub text,
  p_email text,
  p_email_verified boolean
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner uuid;
  v_mine text;
  v_empty boolean;
begin
  if p_user is null or coalesce(p_sub, '') = '' then
    return 'bad_request';
  end if;

  select user_id into v_owner from auth.identities
   where provider = 'apple' and provider_id = p_sub;

  if v_owner = p_user then
    return 'already_linked';
  end if;

  if v_owner is not null then
    -- Attached elsewhere. Reclaim ONLY an empty shell account -- the artifact a
    -- previous broken attempt created (relay email, nothing in it). A real
    -- account is never dissolved.
    select not exists (select 1 from posts where user_id = v_owner)
       and not exists (select 1 from workouts where user_id = v_owner)
       and not exists (select 1 from messages where sender_id = v_owner)
       and not exists (select 1 from stories where user_id = v_owner)
       and not exists (select 1 from checkins where user_id = v_owner)
       and not exists (select 1 from post_comments where user_id = v_owner)
       and not exists (select 1 from friendships where user_id = v_owner or friend_id = v_owner)
       and not exists (
             select 1 from profiles
              where id = v_owner
                and (username is not null or onboarding_stage = 'complete')
           )
      into v_empty;

    if not v_empty then
      return 'apple_id_in_use';
    end if;

    delete from auth.users where id = v_owner;
  end if;

  -- One Apple identity per account.
  select provider_id into v_mine from auth.identities
   where provider = 'apple' and user_id = p_user limit 1;
  if v_mine is not null and v_mine <> p_sub then
    return 'already_has_apple';
  end if;
  if v_mine = p_sub then
    return 'already_linked';
  end if;

  -- identities.email is GENERATED from identity_data -- never written directly.
  insert into auth.identities (
    id, user_id, provider, provider_id, identity_data,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), p_user, 'apple', p_sub,
    jsonb_build_object(
      'sub', p_sub,
      'email', p_email,
      'email_verified', coalesce(p_email_verified, false),
      'provider_id', p_sub
    ),
    now(), now(), now()
  );

  return 'linked';
end;
$function$;

-- Service role only: this bypasses normal identity checks by design.
revoke all on function public.attach_apple_identity(uuid, text, text, boolean) from public;
revoke all on function public.attach_apple_identity(uuid, text, text, boolean) from anon;
revoke all on function public.attach_apple_identity(uuid, text, text, boolean) from authenticated;
grant execute on function public.attach_apple_identity(uuid, text, text, boolean) to service_role;
