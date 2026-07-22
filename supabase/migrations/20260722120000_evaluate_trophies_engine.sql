-- Single trophy evaluation service (Trophy System v2, spec B). Derives each
-- exercise's max from user_lifts (heaviest logged value = source of truth),
-- matches against every rule in trophy_rules, and inserts qualifying unlocks
-- ONCE (idempotent via the (user_id, trophy_id) PK). Returns freshly-inserted
-- rows so the caller can queue the unlock animations. Permanent: only ever
-- inserts, so editing a set downward can't revoke a trophy.
create or replace function public.evaluate_trophies(p_user uuid)
returns table (out_unlock_id text, out_family_id text, out_tier integer, out_name text, out_metric double precision)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with maxes as (
    select ul.exercise,
           max(case when ul.unit <> 'reps' then ul.value end) as max_weight,
           max(case when ul.unit = 'reps' then ul.value end) as max_reps
    from user_lifts ul
    where ul.user_id = p_user
    group by ul.exercise
  ),
  qualifying as (
    select r.unlock_id, r.family_id, r.tier, r.name,
           case when r.metric = 'max_reps' then m.max_reps else m.max_weight end as val
    from trophy_rules r
    join maxes m on m.exercise = r.exercise_id
    where (case when r.metric = 'max_reps' then m.max_reps else m.max_weight end) >= r.threshold
  ),
  inserted as (
    insert into user_trophies (user_id, trophy_id, family_id, tier, metric_value, earned_at)
    select p_user, q.unlock_id, q.family_id, q.tier, q.val, now()
    from qualifying q
    on conflict (user_id, trophy_id) do nothing
    returning trophy_id, family_id, tier, metric_value
  )
  select i.trophy_id,
         i.family_id,
         i.tier,
         (select r.name from trophy_rules r where r.unlock_id = i.trophy_id),
         i.metric_value
  from inserted i;
end;
$$;
grant execute on function public.evaluate_trophies(uuid) to authenticated;

-- Backfill existing history so early beta users' logged lifts count.
do $$
declare u uuid;
begin
  for u in (select distinct user_id from user_lifts) loop
    perform evaluate_trophies(u);
  end loop;
end $$;

-- Server-side hard caps (spec A/D): reject absurd values, never clamp.
create or replace function public.user_lifts_cap_guard()
returns trigger language plpgsql as $$
begin
  if new.unit = 'reps' then
    if new.value < 1 or new.value > 200 then
      raise exception 'reps_out_of_range' using hint = 'Reps must be 1-200';
    end if;
  else
    if new.value < 1 or new.value > 999 then
      raise exception 'weight_out_of_range' using hint = 'Weight must be 1-999 lb';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists user_lifts_cap_guard on public.user_lifts;
create trigger user_lifts_cap_guard
  before insert or update on public.user_lifts
  for each row execute function public.user_lifts_cap_guard();
