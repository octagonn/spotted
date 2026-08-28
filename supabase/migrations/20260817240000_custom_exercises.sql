-- Custom exercises created in Select Exercises used to live in component
-- state only — gone on unmount. Persist them per user so they show up (and
-- are searchable/pinnable) in every future workout.
create table public.custom_exercises (
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  muscle text not null default 'Other' check (char_length(muscle) between 1 and 30),
  -- Default set values mirroring lib/workoutLibrary LibraryItem: lifts carry
  -- weight/reps, cardio carries minutes/miles/incline. Nullable — kind is
  -- inferred client-side the same way as library items.
  def_w numeric,
  def_r numeric,
  def_min numeric,
  def_mi numeric,
  def_inc numeric,
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.custom_exercises enable row level security;

create policy custom_exercises_select_self on public.custom_exercises
  for select using (user_id = (select auth.uid()));
create policy custom_exercises_insert_self on public.custom_exercises
  for insert with check (user_id = (select auth.uid()));
create policy custom_exercises_update_self on public.custom_exercises
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy custom_exercises_delete_self on public.custom_exercises
  for delete using (user_id = (select auth.uid()));
