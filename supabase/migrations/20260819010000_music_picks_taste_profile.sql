-- Every song a user attaches to a post or story. Feeds the "Recommended for
-- you" row in the music picker: the taste profile is the recency-weighted
-- distribution of genres and artists across these rows, so recommendations
-- sharpen the more the app is used.
create table if not exists public.music_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id text not null,
  track_name text,
  artist_id text,
  artist_name text,
  genre_id text,
  genre_name text,
  picked_at timestamptz not null default now()
);

create index if not exists idx_music_picks_user_recent
  on public.music_picks (user_id, picked_at desc);

alter table public.music_picks enable row level security;

-- Strictly personal: taste history is never readable by anyone else.
create policy music_picks_select_own on public.music_picks
  for select using (user_id = (select auth.uid()));
create policy music_picks_insert_own on public.music_picks
  for insert with check (user_id = (select auth.uid()));
create policy music_picks_delete_own on public.music_picks
  for delete using (user_id = (select auth.uid()));

-- Recency-weighted taste profile (half-life ~60 days) so taste can drift.
create or replace function public.music_taste_profile(p_limit int default 6)
returns table (kind text, key text, label text, weight numeric)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  with picks as (
    select genre_id, genre_name, artist_id, artist_name,
           exp(-extract(epoch from (now() - picked_at)) / (60 * 86400.0)) as w
      from music_picks
     where user_id = (select auth.uid())
       and picked_at > now() - interval '1 year'
  ),
  genres as (
    select 'genre'::text as kind, genre_id as key, min(genre_name) as label, sum(w) as weight
      from picks where genre_id is not null group by genre_id
  ),
  artists as (
    select 'artist'::text as kind, artist_id as key, min(artist_name) as label, sum(w) as weight
      from picks where artist_id is not null group by artist_id
  )
  (select * from genres order by weight desc limit p_limit)
  union all
  (select * from artists order by weight desc limit p_limit);
$function$;

grant execute on function public.music_taste_profile(int) to authenticated;
