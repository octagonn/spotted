-- Saved routines: a named workout template you build once and start whenever.
--
-- Distinct from `workouts`, which is history — a record of a session that
-- happened, with times, volume and PRs. A routine has none of that: it's a plan
-- (exercises + their target weights/reps), it doesn't age out of the list as you
-- log more sessions, and renaming or editing it must not rewrite what you
-- actually lifted. Reusing `workouts` with a flag would have meant excluding
-- template rows from every history query, stat total, streak and feed slide.
create table if not exists public.workout_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  -- Same shape as workouts.data->'exercises':
  -- [{ id, name, muscle, kind:'lift'|'cardio', sets:[{ w,r | min,mi,inc, done }] }]
  exercises jsonb not null default '[]'::jsonb,
  -- Drives "recently used" ordering so the routine you actually run stays on top.
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_routines_name_len check (char_length(btrim(name)) between 1 and 60),
  constraint workout_routines_exercises_is_array check (jsonb_typeof(exercises) = 'array')
);

-- The list query: your routines, most recently used first.
create index if not exists workout_routines_user_idx
  on public.workout_routines (user_id, last_used_at desc nulls last, created_at desc);

alter table public.workout_routines enable row level security;

-- Private by design: a routine is a personal plan, not shareable content. No
-- friend/public read path, unlike workouts.
drop policy if exists "workout_routines_select_own" on public.workout_routines;
create policy "workout_routines_select_own" on public.workout_routines
  for select using ((select auth.uid()) = user_id);

drop policy if exists "workout_routines_insert_own" on public.workout_routines;
create policy "workout_routines_insert_own" on public.workout_routines
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "workout_routines_update_own" on public.workout_routines;
create policy "workout_routines_update_own" on public.workout_routines
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "workout_routines_delete_own" on public.workout_routines;
create policy "workout_routines_delete_own" on public.workout_routines
  for delete using ((select auth.uid()) = user_id);

-- Keep updated_at honest without the client having to remember.
create or replace function public.touch_workout_routine()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists workout_routines_touch on public.workout_routines;
create trigger workout_routines_touch
  before update on public.workout_routines
  for each row execute function public.touch_workout_routine();

-- A person can hold plenty of routines, but not an unbounded number — this is a
-- personal library, and the cap is the difference between a bug and a runaway
-- table. Enforced server-side so a client loop can't bypass it.
create or replace function public.enforce_workout_routine_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select count(*) from public.workout_routines where user_id = new.user_id) >= 50 then
    raise exception 'routine_limit_reached' using hint = 'Delete a routine before saving another.';
  end if;
  return new;
end;
$function$;

drop trigger if exists workout_routines_cap on public.workout_routines;
create trigger workout_routines_cap
  before insert on public.workout_routines
  for each row execute function public.enforce_workout_routine_cap();
