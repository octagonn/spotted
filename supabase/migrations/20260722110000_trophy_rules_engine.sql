-- Trophy System v2: declarative rules table + single evaluation engine.
-- See evaluate_trophies() — one code path, idempotent, permanent, backfilled.
-- (Full DDL applied via MCP; this file documents the schema for the repo.)
alter table public.user_trophies
  add column if not exists family_id text,
  add column if not exists metric_value double precision;

create table if not exists public.trophy_rules (
  unlock_id text primary key,
  family_id text not null,
  tier integer not null,
  name text not null,
  exercise_id text not null,
  metric text not null,
  threshold double precision not null,
  comparator text not null default 'gte'
);
alter table public.trophy_rules enable row level security;
drop policy if exists trophy_rules_read on public.trophy_rules;
create policy trophy_rules_read on public.trophy_rules for select using (true);
-- Rule rows seeded from the trophy catalog (bench/squat/deadlift = max_weight,
-- pullups/pushups = max_reps). See 20260722110000 companion data in MCP history.
