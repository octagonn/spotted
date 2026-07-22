-- ============ Trophy System v2: workout-based unlock engine ============
-- One declarative ruleset + one evaluation function. Runs on every
-- trophy-relevant write (user_lifts trigger) and on demand from the client
-- (returns the newly-unlocked rows so the save screen can fire the unlock
-- moment). Idempotent: user_trophies is insert-once per (user, trophy, tier).

-- 1) Rules live in a table, not code — add trophies without a release.
create table if not exists public.trophy_rules (
  trophy_id text not null,
  tier integer not null,               -- threshold value doubles as the tier id
  tier_name text not null,
  metric text not null check (metric in ('max_weight', 'max_reps')),
  exercise text not null,              -- user_lifts.exercise key
  threshold numeric not null,
  comparator text not null default 'gte' check (comparator in ('gte')),
  primary key (trophy_id, tier)
);
alter table public.trophy_rules enable row level security;
drop policy if exists trophy_rules_read on public.trophy_rules;
create policy trophy_rules_read on public.trophy_rules for select using (true);

insert into public.trophy_rules (trophy_id, tier, tier_name, metric, exercise, threshold) values
  ('bench', 135, 'Warming Up', 'max_weight', 'bench', 135),
  ('bench', 185, 'Getting Serious', 'max_weight', 'bench', 185),
  ('bench', 205, 'Almost There', 'max_weight', 'bench', 205),
  ('bench', 225, 'In the Club', 'max_weight', 'bench', 225),
  ('bench', 275, 'Heavy Hitter', 'max_weight', 'bench', 275),
  ('bench', 315, 'Lay of the Roids', 'max_weight', 'bench', 315),
  ('bench', 365, 'Freak Strength', 'max_weight', 'bench', 365),
  ('bench', 405, 'The 405 Club', 'max_weight', 'bench', 405),
  ('bench', 500, 'Titan', 'max_weight', 'bench', 500),
  ('squat', 135, 'First Steps', 'max_weight', 'squat', 135),
  ('squat', 185, 'Chicken Legs', 'max_weight', 'squat', 185),
  ('squat', 225, 'Leg Day Believer', 'max_weight', 'squat', 225),
  ('squat', 275, 'Quadzilla Jr.', 'max_weight', 'squat', 275),
  ('squat', 315, 'Quads of Steel', 'max_weight', 'squat', 315),
  ('squat', 365, 'Squatzilla', 'max_weight', 'squat', 365),
  ('squat', 405, 'Four Wheel Drive', 'max_weight', 'squat', 405),
  ('squat', 455, 'Earthquake', 'max_weight', 'squat', 455),
  ('squat', 500, 'Five Hundred Deep', 'max_weight', 'squat', 500),
  ('deadlift', 135, 'Baby', 'max_weight', 'deadlift', 135),
  ('deadlift', 225, 'Picking Things Up', 'max_weight', 'deadlift', 225),
  ('deadlift', 275, 'Grip It & Rip It', 'max_weight', 'deadlift', 275),
  ('deadlift', 315, 'Dead Serious', 'max_weight', 'deadlift', 315),
  ('deadlift', 365, 'Back Breaker', 'max_weight', 'deadlift', 365),
  ('deadlift', 405, 'Four Plate Pull', 'max_weight', 'deadlift', 405),
  ('deadlift', 455, 'Gravity''s Enemy', 'max_weight', 'deadlift', 455),
  ('deadlift', 500, 'The Five Hundred', 'max_weight', 'deadlift', 500),
  ('deadlift', 585, 'Kratos', 'max_weight', 'deadlift', 585),
  ('pullups', 5, 'Hang In There', 'max_reps', 'pullups', 5),
  ('pullups', 10, 'Double Digits', 'max_reps', 'pullups', 10),
  ('pullups', 15, 'Chin Up', 'max_reps', 'pullups', 15),
  ('pullups', 20, 'Bar Owner', 'max_reps', 'pullups', 20),
  ('pullups', 25, 'GoArmy.com', 'max_reps', 'pullups', 25),
  ('pullups', 30, 'Anti-Gravity', 'max_reps', 'pullups', 30),
  ('pullups', 40, 'Bird of Prey', 'max_reps', 'pullups', 40),
  ('pullups', 50, 'Air Force One', 'max_reps', 'pullups', 50),
  ('pushups', 25, 'Floor Work', 'max_reps', 'pushups', 25),
  ('pushups', 50, 'Drop & Give Me 50', 'max_reps', 'pushups', 50),
  ('pushups', 75, 'Chest Day Every Day', 'max_reps', 'pushups', 75),
  ('pushups', 100, 'Get a Hobby', 'max_reps', 'pushups', 100),
  ('pushups', 150, 'Machine', 'max_reps', 'pushups', 150),
  ('pushups', 200, 'Boot Camp Nightmare', 'max_reps', 'pushups', 200)
on conflict (trophy_id, tier) do nothing;

-- 2) user_trophies: one row per earned TIER (insert-once). Old PK was
--    (user_id, trophy_id); table is empty, so re-key safely.
alter table public.user_trophies drop constraint if exists user_trophies_pkey;
alter table public.user_trophies add primary key (user_id, trophy_id, tier);

-- 3) Hard caps (anti-abuse D): weight 1–999 lb, reps 1–200 — enforced at the
--    source of truth. Rejected loudly (constraint error), never clamped.
alter table public.user_lifts drop constraint if exists user_lifts_value_caps;
alter table public.user_lifts add constraint user_lifts_value_caps check (
  (unit = 'lb' and value >= 1 and value <= 999)
  or (unit = 'reps' and value >= 1 and value <= 200)
);

-- 4) THE engine. Derives the max per exercise from logged lifts, compares to
--    the ruleset, inserts anything newly crossed, returns just the new rows
--    (so the client can fire unlock moments). Permanent: never deletes —
--    editing a set downward keeps earned trophies.
create or replace function public.evaluate_trophies(p_user uuid default null)
returns table (trophy_id text, tier integer, tier_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  -- Only the user themself (or a definer caller like the trigger) evaluates.
  if auth.uid() is not null and uid <> auth.uid() then
    raise exception 'forbidden';
  end if;
  return query
  with maxes as (
    select ul.exercise, max(ul.value) as best
    from user_lifts ul
    where ul.user_id = uid
    group by ul.exercise
  ),
  crossed as (
    select r.trophy_id, r.tier, r.tier_name
    from trophy_rules r
    join maxes m on m.exercise = r.exercise
    where m.best >= r.threshold
  ),
  inserted as (
    insert into user_trophies (user_id, trophy_id, tier, earned_at)
    select uid, c.trophy_id, c.tier, now() from crossed c
    on conflict (user_id, trophy_id, tier) do nothing
    returning user_trophies.trophy_id, user_trophies.tier
  )
  select i.trophy_id, i.tier, r.tier_name
  from inserted i
  join trophy_rules r on r.trophy_id = i.trophy_id and r.tier = i.tier
  order by i.tier desc;
end;
$$;
grant execute on function public.evaluate_trophies(uuid) to authenticated;

-- 5) Consistency: every lift insert re-evaluates (trigger discards the rows).
create or replace function public.user_lifts_evaluate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluate_trophies(new.user_id);
  return new;
exception when others then
  return new; -- logging a lift must never fail because evaluation did
end;
$$;
drop trigger if exists user_lifts_evaluate on public.user_lifts;
create trigger user_lifts_evaluate
  after insert or update on public.user_lifts
  for each row execute function public.user_lifts_evaluate();

-- 6) Backfill: evaluate everyone with logged lifts so existing history counts.
do $$
declare u uuid;
begin
  for u in select distinct user_id from user_lifts loop
    perform public.evaluate_trophies(u);
  end loop;
end $$;

-- ============ Spec C removals: the claim/approval system is dead ============
drop function if exists public.review_trophy_claim(uuid, boolean, text);
drop table if exists public.troph