-- Pinned/favorited exercises: float the user's go-to lifts to the top of the
-- Select Exercises screen. Keyed by exercise NAME (the workout library and
-- custom exercises are name-identified client-side).
create table public.exercise_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_name text not null check (char_length(exercise_name) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_name)
);

alter table public.exercise_favorites enable row level security;

create policy exercise_favorites_select_self on public.exercise_favorites
  for select using (user_id = (select auth.uid()));
create policy exercise_favorites_insert_self on public.exercise_favorites
  for insert with check (user_id = (select auth.uid()));
create policy exercise_favorites_delete_self on public.exercise_favorites
  for delete using (user_id = (select auth.uid()));
