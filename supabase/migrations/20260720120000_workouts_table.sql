-- My Workouts: a finished (or in-progress) workout session. The full set-by-set
-- structure lives in `data` (jsonb); summary columns are denormalized for cheap
-- list/feed rendering. PR lifts are logged separately into user_lifts on finish.
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Workout',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  total_volume real not null default 0 check (total_volume >= 0),
  total_sets integer not null default 0 check (total_sets >= 0),
  cardio_minutes real not null default 0 check (cardio_minutes >= 0),
  exercise_count integer not null default 0 check (exercise_count >= 0),
  -- [{ id, name, muscle, kind:'lift'|'cardio', sets:[{ w,r | min,mi,inc, done }] }]
  data jsonb not null default '[]'::jsonb,
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists workouts_user_started_idx
  on public.workouts (user_id, started_at desc);

alter table public.workouts enable row level security;

-- Owner can do anything with their own workouts.
create policy "workouts_insert_own" on public.workouts
  for insert with check (auth.uid() = user_id);
create policy "workouts_update_own" on public.workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workouts_delete_own" on public.workouts
  for delete using (auth.uid() = user_id);
-- Owner or a friend can read (history is visible on friends' profiles, like trophies).
create policy "workouts_select_own_or_friends" on public.workouts
  for select using (auth.uid() = user_id or public.are_friends(auth.uid(), user_id));
