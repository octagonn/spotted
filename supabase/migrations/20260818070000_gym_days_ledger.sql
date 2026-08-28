-- Gym days were derived from posts rows, so DELETING a post erased that day
-- from the streak calendar (and eventually the streak). This ledger records
-- the day permanently when a daily post is published; deleting the post keeps
-- the day (the calendar cell just loses its photo preview).
create table public.gym_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  -- The day's post, for the calendar thumbnail. NULL after the post is
  -- deleted — the day itself remains.
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.gym_days enable row level security;
-- Same visibility as the profile content it decorates (own/friends/public).
create policy gym_days_select_visible on public.gym_days
  for select using (can_view_content((select auth.uid()), user_id));
-- Writes happen only via the security-definer trigger below.

create or replace function public.record_gym_day() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text;
  local_day date;
begin
  if not new.is_daily_drop then return new; end if;
  select timezone into tz from profiles where id = new.user_id;
  local_day := (new.created_at at time zone coalesce(nullif(tz, ''), 'UTC'))::date;
  insert into gym_days (user_id, day, post_id)
  values (new.user_id, local_day, new.id)
  on conflict (user_id, day) do update set post_id = excluded.post_id;
  return new;
end $$;

drop trigger if exists posts_record_gym_day on public.posts;
create trigger posts_record_gym_day after insert on public.posts
  for each row execute function record_gym_day();

-- Backfill from every existing daily post (owner-timezone day boundary).
insert into public.gym_days (user_id, day, post_id)
select distinct on (p.user_id, (p.created_at at time zone coalesce(nullif(pr.timezone, ''), 'UTC'))::date)
  p.user_id,
  (p.created_at at time zone coalesce(nullif(pr.timezone, ''), 'UTC'))::date,
  p.id
from public.posts p
join public.profiles pr on pr.id = p.user_id
where p.is_daily_drop
order by p.user_id, (p.created_at at time zone coalesce(nullif(pr.timezone, ''), 'UTC'))::date, p.created_at desc
on conflict (user_id, day) do nothing;
