-- Catalogue depth, genre normalisation, and era balance for the music picker.
--
-- Problem: the pool was today's charts only, so nothing older than a few weeks
-- could ever be recommended. Three fixes, in the order they were found:
--
-- 1. DEPTH — the daily job (refresh-music-chart) now also caches ARTIST
--    CATALOGUES, which reach back years. Verified live: the pool went from 176
--    tracks (2025-2026 only) to 713 reaching back to 1955.
--
-- 2. GENRE MATCHING — Apple labels the same music differently per feed
--    ("Hip-Hop/Rap" on the charts vs "Hip-Hop"/"Rap" in a catalogue), and
--    catalogue rows carry no genre id at all, so taste built from one source
--    could never match the other. music_genre_key() normalises both sides.
--
-- 3. ERA BALANCE — even with the whole row on-taste it was still almost all
--    brand-new, because the chart bonus broke every tie toward this week's
--    releases. The row is now mixed playlist-style: ~40% throwbacks (2+ years
--    old) interleaved with current tracks, all still chosen by taste.
alter table public.music_chart_daily add column if not exists release_year int;

create or replace function public.music_genre_key(p_name text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_name is null then null
    when lower(p_name) in ('hip-hop/rap', 'hip-hop', 'rap', 'hip hop') then 'hip-hop'
    when lower(p_name) in ('r&b/soul', 'soul', 'r&b') then 'r&b'
    when lower(p_name) in ('rock', 'hard rock', 'metal', 'alternative', 'punk') then 'rock'
    when lower(p_name) in ('latin', 'música mexicana', 'musica mexicana', 'música tropical',
                           'musica tropical', 'urbano latino', 'reggaeton') then 'latin'
    when lower(p_name) in ('dance', 'electronica', 'electronic', 'house', 'edm') then 'dance'
    when lower(p_name) in ('country', 'singer/songwriter', 'americana') then 'country'
    when lower(p_name) in ('pop', 'k-pop', 'dance pop') then 'pop'
    else lower(p_name)
  end;
$function$;

grant execute on function public.music_genre_key(text) to authenticated, service_role;

create index if not exists idx_music_chart_genre_key
  on public.music_chart_daily (day, (public.music_genre_key(genre_name)));

-- Artists this community picks: the seed list the daily job pulls catalogues
-- for, and a collaborative signal. Service role only (aggregates all users).
create or replace function public.music_community_artists(p_limit int default 40)
returns table (artist_id text, artist_name text, picks bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select artist_id, min(artist_name) as artist_name, count(*) as picks
    from music_picks
   where artist_id is not null
     and picked_at > now() - interval '90 days'
   group by artist_id
   order by count(*) desc
   limit p_limit;
$function$;

revoke all on function public.music_community_artists(int) from public;
revoke all on function public.music_community_artists(int) from anon;
revoke all on function public.music_community_artists(int) from authenticated;
grant execute on function public.music_community_artists(int) to service_role;

/**
 * Personalised picks — taste first, catalogue included, eras mixed.
 *
 * Signals, by influence:
 *   1. artist affinity  (2.5) — strongest predictor of a repeat pick
 *   2. genre affinity   (1.2) — on the NORMALISED key, so catalogue and charts agree
 *   3. community pull   (0.8 max) — collaborative signal; surfaces older tracks
 *   4. chart position   (0.3) — chart rows only, a nudge and never the driver
 *
 * Recently used songs (14 days) are held back so the row stays fresh, but a
 * favourite can return after that instead of being banned forever.
 */
create or replace function public.music_recommendations(p_limit int default 10)
returns setof public.music_chart_daily
language sql
stable
security invoker
set search_path to 'public'
as $function$
  with params as (
    select greatest(1, floor(p_limit * 0.4)::int) as throwback_quota,
           extract(year from now())::int - 2      as throwback_before
  ),
  taste as (
    select music_genre_key(genre_name) as gkey, artist_id,
           exp(-extract(epoch from (now() - picked_at)) / (60 * 86400.0)) as w
      from music_picks
     where user_id = (select auth.uid())
       and picked_at > now() - interval '1 year'
  ),
  genre_w  as (select gkey, sum(w) as w from taste where gkey is not null group by gkey),
  artist_w as (select artist_id, sum(w) as w from taste where artist_id is not null group by artist_id),
  recent_used as (
    select distinct track_id from music_picks
     where user_id = (select auth.uid()) and picked_at > now() - interval '14 days'
  ),
  community as (
    select track_id, count(*)::numeric as picks
      from music_picks
     where picked_at > now() - interval '90 days'
     group by track_id
  ),
  today as (select * from music_chart_daily where day = (select max(day) from music_chart_daily)),
  scored as (
    select t.*,
           coalesce(a.w, 0) * 2.5
         + coalesce(g.w, 0) * 1.2
         + least(coalesce(c.picks, 0), 10) * 0.08
         + case when t.source = 'top' then greatest(0, 1 - t.rank / 50.0) * 0.3 else 0 end
           as score,
           (t.release_year is not null and t.release_year <= (select throwback_before from params)) as is_throwback
      from today t
      left join genre_w  g on g.gkey      = music_genre_key(t.genre_name)
      left join artist_w a on a.artist_id = t.artist_id
      left join community c on c.track_id = t.track_id
     where t.preview_url is not null
       and t.track_id not in (select track_id from recent_used)
  ),
  capped as (
    select * from (
      select *, row_number() over (partition by coalesce(artist_id, artist) order by score desc) as per_artist
        from scored
    ) a where per_artist <= 2
  ),
  bucketed as (
    select *, row_number() over (partition by is_throwback order by score desc) as rn_bucket
      from capped
  ),
  slotted as (
    select b.*,
           case
             -- Interleave: current on odd slots, throwbacks on even ones.
             when b.is_throwback and b.rn_bucket <= p.throwback_quota then b.rn_bucket * 2
             when not b.is_throwback and b.rn_bucket <= p_limit - p.throwback_quota then b.rn_bucket * 2 - 1
             -- Overflow, used only when one bucket is short.
             else 100 + b.rn_bucket
           end as slot
      from bucketed b cross join params p
  )
  select day, rank, track_id, title, artist, artist_id, genre_id, genre_name,
         artwork_url, preview_url, explicit, source, release_year
    from slotted
   order by slot, score desc
   limit p_limit;
$function$;

grant execute on function public.music_recommendations(int) to authenticated;

-- Same normalisation on the taste side so both speak one vocabulary.
create or replace function public.music_taste_profile(p_limit int default 6)
returns table (kind text, key text, label text, weight numeric)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  with picks as (
    select music_genre_key(genre_name) as gkey, genre_name, artist_id, artist_name,
           exp(-extract(epoch from (now() - picked_at)) / (60 * 86400.0)) as w
      from music_picks
     where user_id = (select auth.uid())
       and picked_at > now() - interval '1 year'
  ),
  genres as (
    select 'genre'::text as kind, gkey as key, min(genre_name) as label, sum(w) as weight
      from picks where gkey is not null group by gkey
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
