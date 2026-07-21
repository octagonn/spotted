-- Trophy rarity — records which trophies each user has earned, and exposes an
-- app-wide rarity RPC (percent of all users who hold each trophy). The client
-- (hooks/queries/useTrophyRarity) reads trophy_rarity() and falls back to seed
-- estimates for any trophy id the RPC does not yet return.

-- ── Earned-trophy ledger ────────────────────────────────────────────────────
-- One row per (user, trophy). `tier` is the highest earned tier threshold for
-- stacked trophies (bench/streaks/…), NULL for standalone badges.
create table if not exists public.user_trophies (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  trophy_id  text        not null,
  tier       integer,
  earned_at  timestamptz not null default now(),
  primary key (user_id, trophy_id)
);

create index if not exists user_trophies_trophy_idx on public.user_trophies (trophy_id);

alter table public.user_trophies enable row level security;

-- Users manage only their own earned trophies.
drop policy if exists "user_trophies_select_own" on public.user_trophies;
create policy "user_trophies_select_own"
  on public.user_trophies for select
  using (auth.uid() = user_id);

drop policy if exists "user_trophies_insert_own" on public.user_trophies;
create policy "user_trophies_insert_own"
  on public.user_trophies for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_trophies_update_own" on public.user_trophies;
create policy "user_trophies_update_own"
  on public.user_trophies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── App-wide rarity ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so the aggregate can see all users' earns (RLS would
-- otherwise scope each caller to their own rows). Returns only aggregate
-- counts + percentages — never another user's identity.
create or replace function public.trophy_rarity()
returns table (trophy_id text, earned_count bigint, total_users bigint, pct numeric)
language sql
stable
security definer
set search_path = public
as $$
  with total as (
    select greatest(count(*), 1)::bigint as n from public.profiles
  )
  select
    t.trophy_id,
    count(distinct t.user_id)::bigint                                    as earned_count,
    (select n from total)                                                as total_users,
    round(count(distinct t.user_id)::numeric * 100 / (select n from total), 2) as pct
  from public.user_trophies t
  group by t.trophy_id;
$$;

grant execute on function public.trophy_rarity() to anon, authenticated;
