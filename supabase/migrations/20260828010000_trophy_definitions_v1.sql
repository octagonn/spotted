-- Trophies v2: data-driven definitions (spec: Spotted Trophies v1).
-- Adding a trophy = inserting a row here; the engine (next migration) reads
-- rule_type/rule_params generically. Applied 2026-08-28 via MCP as
-- "trophy_definitions_v1"; this file mirrors it (catalog seed included).
do $$ begin
  create type public.trophy_category as enum ('streak','total_checkins','comeback','community','milestone','pr','novelty','social');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.trophy_tier as enum ('bronze','silver','gold','diamond');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.trophy_rule_type as enum ('threshold','event','calendar','composite');
exception when duplicate_object then null; end $$;

create table if not exists public.trophy_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category public.trophy_category not null,
  tier public.trophy_tier,
  name text not null,
  description text not null default '',
  icon text not null default 'trophy',
  rule_type public.trophy_rule_type not null,
  rule_params jsonb not null default '{}'::jsonb,
  family text,
  sort int not null default 0,
  repeatable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.trophy_definitions enable row level security;
drop policy if exists trophy_definitions_read on public.trophy_definitions;
create policy trophy_definitions_read on public.trophy_definitions for select using (true);

alter table public.user_trophies add column if not exists definition_id uuid references public.trophy_definitions(id) on delete set null;
alter table public.user_trophies add column if not exists instance_key text not null default '';
alter table public.user_trophies add column if not exists context jsonb not null default '{}'::jsonb;
alter table public.user_trophies add column if not exists celebrated_at timestamptz;
alter table public.user_trophies alter column tier drop not null;
alter table public.user_trophies drop constraint if exists user_trophies_pkey;
alter table public.user_trophies add primary key (user_id, trophy_id, instance_key);
create index if not exists user_trophies_definition_idx on public.user_trophies (definition_id);
create index if not exists user_trophies_earned_idx on public.user_trophies (user_id, earned_at desc);

drop policy if exists user_trophies_select_own on public.user_trophies;
drop policy if exists user_trophies_select_visible on public.user_trophies;
create policy user_trophies_select_visible on public.user_trophies for select
  using (public.can_view_content((select auth.uid()), user_id));

-- Catalog seed (streak/check-in ladders, comeback, community, milestones,
-- novelty, social, PR ladders from trophy_rules + named clubs, cardio
-- inactive) — see the applied migration in the Supabase dashboard for the
-- full VALUES list; keys: streak_{bronze,silver,gold,diamond},
-- checkins_{bronze,silver,gold,diamond}, comeback, phoenix, top_of_gym,
-- three_peat, first_checkin, day_one, first_crew, referral, early_bird,
-- night_owl, rush_hour, lunch_break, five_am_club, weekend_warrior,
-- never_miss_monday, perfect_week, new_year, summer_shred, holiday_hustle,
-- birthday_beast, leap_day, anniversary, regular, gym_hopper, thick_skin,
-- welcome_wagon, squad_goals, <exercise>:<threshold> (pr), deadlift:600,
-- first_5k, sub6_mile, sub5_mile, sub20_5k, sub18_5k (inactive).
--
-- Earned-history key mapping applied: streaks:7→streak_bronze, day-one→day_one,
-- first-crew→first_crew, tequila-sunrise→early_bird, dark-night→night_owl,
-- rush-hour→rush_hour; definition_id/family_id backfilled from keys.
