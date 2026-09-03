-- The onboarding flow gained a 'friends' step (add-friends screen) but the
-- stage check constraint still listed only the original stages — every write
-- of onboarding_stage='friends' (advancing past home-gym) was rejected,
-- blocking all new signups from completing onboarding. Allow it; keep the
-- legacy 'schedule' value for rows that still carry it.
alter table public.profiles drop constraint profiles_onboarding_stage_check;
alter table public.profiles add constraint profiles_onboarding_stage_check
  check (onboarding_stage = any (array['permissions'::text, 'home-gym'::text, 'friends'::text, 'schedule'::text, 'complete'::text]));
