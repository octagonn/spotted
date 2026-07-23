-- Decouple workout HISTORY from daily-post SLIDES: "deleting" or editing a
-- workout from the workout tab must not touch the version shown on the daily
-- post. hidden_at hides a row from the owner's history lists while the row
-- (and its post_id join) keeps feeding the post slide unchanged.
alter table public.workouts
  add column if not exists hidden_at timestamptz;
