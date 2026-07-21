-- Durable onboarding progress + birth date (13+ minimum age).
-- Existing profiles default to 'complete' so current users are unaffected.

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists onboarding_stage text not null default 'complete';

alter table public.profiles
  add constraint profiles_onboarding_stage_check
  check (onboarding_stage in ('permissions', 'home-gym', 'schedule', 'complete'));

alter table public.profiles
  add constraint profiles_min_age_check
  check (birth_date is null or birth_date <= (current_date - interval '13 years'));
