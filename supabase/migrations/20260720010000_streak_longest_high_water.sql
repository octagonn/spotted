-- Longest streak high-water mark + client bump RPC. See remote migration
-- streak_longest_high_water (2026-07-20).
create or replace function public.keep_longest_streak() returns trigger
language plpgsql as $$
begin
  new.longest_streak := greatest(
    coalesce(new.longest_streak, 0),
    coalesce(new.current_streak, 0),
    coalesce(old.longest_streak, 0)
  );
  return new;
end $$;
drop trigger if exists streaks_keep_longest on public.streaks;
create trigger streaks_keep_longest before update on public.streaks
  for each row execute function public.keep_longest_streak();
update public.streaks set longest_streak = greatest(longest_streak, current_streak)
where longest_streak < current_streak;
create or replace function public.record_streak_high_water(p_streak integer)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  insert into streaks (user_id, current_streak, longest_streak)
  values (auth.uid(), p_streak, p_streak)
  on conflict (user_id) do update
    set longest_streak = greatest(streaks.longest_streak, p_streak);
end $$;
revoke execute on function public.record_streak_high_water(integer) from public, anon;
grant execute on function public.record_streak_high_water(integer) to authenticated;
