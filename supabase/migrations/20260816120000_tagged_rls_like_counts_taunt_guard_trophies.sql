-- ── 1) can_read_post: drop the expiry requirement ────────────────────────────
-- Expiry is a FEED concept (20260722100000 already widened posts_select_visible
-- for the archive). can_read_post still required expires_at > now(), which made
-- post_tags rows (the profile TAGGED grid), reactions and comments invisible on
-- any post older than 24h — the "tagged him and it doesn't show on his profile"
-- bug. Posts RLS still gates friendship + blocks; this just stops re-hiding
-- what the archive deliberately shows.
create or replace function public.can_read_post(p_post_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from posts p
    where p.id = p_post_id
      and (p.user_id = p_user_id or are_friends(p.user_id, p_user_id))
      and not is_blocked(p.user_id, p_user_id)
  );
$$;

-- ── 2) posts.like_count, maintained by trigger ───────────────────────────────
-- Denormalized so the feed shows like counts with zero extra round-trips.
alter table public.posts add column if not exists like_count integer not null default 0;

create or replace function public.sync_post_like_count()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.post_id, old.post_id);
begin
  update posts set like_count = (
    select count(*) from post_reactions
    where post_id = pid and reaction = '🔥'
  ) where id = pid;
  return null;
end $$;

drop trigger if exists trg_sync_post_like_count on public.post_reactions;
create trigger trg_sync_post_like_count
after insert or update or delete on public.post_reactions
for each row execute function public.sync_post_like_count();

-- Backfill existing posts.
update public.posts p set like_count = sub.n
from (
  select post_id, count(*)::int as n
  from public.post_reactions
  where reaction = '🔥'
  group by post_id
) sub
where p.id = sub.post_id;

-- ── 3) record_trophies: persist client-derived behavior trophies ─────────────
-- The behavior trophy engine (time-of-day, holidays, dedication, streaks,
-- weekend, home-turf, firsts) derives earns client-side from the user's own
-- post history. Recording them here makes trophy_rarity() real for the whole
-- catalog. Strength families are excluded — those only unlock through
-- evaluate_trophies (user_lifts), so a crafted call can't spoof a 500 bench.
create or replace function public.record_trophies(p_trophy_ids text[])
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  insert into user_trophies (user_id, trophy_id, family_id, earned_at)
  select uid, t.id, split_part(t.id, ':', 1), now()
  from unnest(p_trophy_ids) as t(id)
  where t.id ~ '^[a-z0-9:-]{1,64}$'
    and split_part(t.id, ':', 1) not in ('bench','squat','deadlift','pullups','pushups')
  on conflict (user_id, trophy_id) do nothing;
end $$;

grant execute on function public.record_trophies(text[]) to authenticated;

-- ── 4) Taunts: close the unguarded legacy path, stop trusting client clocks ──
-- send_taunt(uuid,text) had no target-already-posted / daily-limit / quiet-hour
-- / mute checks and bypassed the taunts table entirely (the inbox "Taunt"
-- button used it — the "can still taunt people who already went" hole).
drop function if exists public.send_taunt(uuid, text);

-- send_taunt_line: compute day boundaries server-side from each user's profile
-- timezone instead of trusting the client-supplied p_since (which could be set
-- in the future to bypass target_already_posted / daily_send_limit /
-- already_taunted_target). p_since stays in the signature for API compat but is
-- now ignored.
create or replace function public.send_taunt_line(p_target uuid, p_line_id text, p_line_text text, p_since timestamp with time zone)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sender_tz text;
  target_tz text;
  sender_since timestamptz;
  target_since timestamptz;
  taunt_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_target = uid then raise exception 'cannot_taunt_self'; end if;
  if not are_friends(uid, p_target) then raise exception 'not_friends'; end if;

  select timezone into sender_tz from profiles where id = uid;
  select timezone into target_tz from profiles where id = p_target;
  sender_since := date_trunc('day', now() at time zone coalesce(nullif(sender_tz, ''), 'UTC'))
                  at time zone coalesce(nullif(sender_tz, ''), 'UTC');
  target_since := date_trunc('day', now() at time zone coalesce(nullif(target_tz, ''), 'UTC'))
                  at time zone coalesce(nullif(target_tz, ''), 'UTC');

  if not exists (select 1 from posts where user_id = uid and created_at >= sender_since) then
    raise exception 'sender_not_posted';
  end if;
  if exists (select 1 from posts where user_id = p_target and created_at >= target_since) then
    raise exception 'target_already_posted';
  end if;
  if (select count(*) from taunts where sender_id = uid and sent_at >= sender_since) >= 5 then
    raise exception 'daily_send_limit';
  end if;
  if exists (select 1 from taunts where sender_id = uid and target_id = p_target and sent_at >= sender_since) then
    raise exception 'already_taunted_target';
  end if;
  if extract(hour from now() at time zone coalesce(nullif(target_tz, ''), 'UTC')) >= 21 then
    raise exception 'target_quiet_hours';
  end if;

  insert into taunts (sender_id, target_id, line_id) values (uid, p_target, p_line_id)
  returning id into taunt_id;

  -- Per-friend mute: recipient silenced this sender's taunts.
  if not exists (select 1 from taunt_mutes where user_id = p_target and muted_id = uid) then
    -- Gate dedupes 1 sender->recipient per day (spec).
    perform dispatch_notification(
      p_target, uid, 'taunt',
      'taunt:' || p_target::text || ':' || uid::text || ':' || (now() at time zone coalesce(nullif(target_tz,''),'UTC'))::date::text,
      jsonb_build_object('text', left(p_line_text, 140), 'taunt_id', taunt_id)
    );
  end if;
  return taunt_id;
end $$;

-- Anon has no business calling any of these.
revoke execute on function public.record_trophies(text[]) from anon;
revoke execute on function public.send_taunt_line(uuid, text, text, timestamptz) from anon;
revoke execute on function public.sync_post_like_count() from anon, authenticated;
