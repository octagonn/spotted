-- Today's music catalogue, fetched ONCE for the whole app by the
-- refresh-music-chart edge function (pg_cron, daily). Clients read one cheap
-- query instead of every device calling Apple's feeds on open.
create table if not exists public.music_chart_daily (
  day date not null,
  rank int not null,
  track_id text not null,
  title text not null,
  artist text not null,
  artist_id text,
  genre_id text,
  genre_name text,
  artwork_url text,
  preview_url text,
  explicit boolean not null default false,
  -- 'top' = overall chart, 'genre' = deeper per-genre pool for recommendations.
  source text not null default 'top',
  primary key (day, track_id)
);

create index if not exists idx_music_chart_day_rank on public.music_chart_daily (day, source, rank);
create index if not exists idx_music_chart_day_genre on public.music_chart_daily (day, genre_id);

alter table public.music_chart_daily enable row level security;

-- Public catalogue data: any signed-in user may read; only the refresh job writes.
create policy music_chart_read on public.music_chart_daily
  for select to authenticated using (true);

-- Personalised picks, computed in the database from the cached chart + the
-- caller's taste profile. Score = genre affinity + artist affinity (weighted
-- higher) + a small chart bonus, minus anything already used, capped at two
-- songs per artist so one favourite cannot fill the row.
create or replace function public.music_recommendations(p_limit int default 10)
returns setof public.music_chart_daily
language sql
stable
security invoker
set search_path to 'public'
as $function$
  with taste as (
    select genre_id, artist_id,
           exp(-extract(epoch from (now() - picked_at)) / (60 * 86400.0)) as w
      from music_picks
     where user_id = (select auth.uid())
       and picked_at > now() - interval '1 year'
  ),
  genre_w as (select genre_id, sum(w) as w from taste where genre_id is not null group by genre_id),
  artist_w as (select artist_id, sum(w) as w from taste where artist_id is not null group by artist_id),
  used as (select distinct track_id from music_picks where user_id = (select auth.uid())),
  today as (select * from music_chart_daily where day = (select max(day) from music_chart_daily)),
  scored as (
    select t.*,
           coalesce(g.w, 0) * 1.0
         + coalesce(a.w, 0) * 1.5
         + greatest(0, 1 - t.rank / 50.0) * 0.4 as score
      from today t
      left join genre_w g on g.genre_id = t.genre_id
      left join artist_w a on a.artist_id = t.artist_id
     where t.preview_url is not null
       and t.track_id not in (select track_id from used)
  ),
  ranked as (
    select *, row_number() over (partition by coalesce(artist_id, artist) order by score desc) as per_artist
      from scored
  )
  select day, rank, track_id, title, artist, artist_id, genre_id, genre_name,
         artwork_url, preview_url, explicit, source
    from ranked
   where per_artist <= 2
   order by score desc, rank asc
   limit p_limit;
$function$;

grant execute on function public.music_recommendations(int) to authenticated;

-- Daily refresh. Uses the ANON key deliberately: the endpoint is a no-op once
-- today's rows exist, so no privileged secret needs to live in the database.
-- (Scheduled out-of-band via cron.schedule('refresh-music-chart', '15 9 * * *', ...).)
