-- ============ Spec B: Taunts ============
create table if not exists public.taunts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  line_id text not null,
  sent_at timestamptz not null default now(),
  answered_post_id uuid references public.posts(id) on delete set null
);
create index if not exists taunts_sender_day_idx on public.taunts (sender_id, sent_at desc);
create index if not exists taunts_target_idx on public.taunts (target_id, sent_at desc);

alter table public.taunts enable row level security;
drop policy if exists taunts_select_own on public.taunts;
create policy taunts_select_own on public.taunts
  for select using (sender_id = (select auth.uid()) or target_id = (select auth.uid()));

create or replace function public.send_taunt_line(
  p_target uuid, p_line_id text, p_line_text text, p_since timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  target_tz text;
  taunt_id uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_target = uid then raise exception 'cannot_taunt_self'; end if;
  if not are_friends(uid, p_target) then raise exception 'not_friends'; end if;
  if not exists (select 1 from posts where user_id = uid and created_at >= p_since) then
    raise exception 'sender_not_posted';
  end if;
  if exists (select 1 from posts where user_id = p_target and created_at >= p_since) then
    raise exception 'target_already_posted';
  end if;
  if (select count(*) from taunts where sender_id = uid and sent_at >= p_since) >= 5 then
    raise exception 'daily_send_limit';
  end if;
  if exists (select 1 from taunts where sender_id = uid and target_id = p_target and sent_at >= p_since) then
    raise exception 'already_taunted_target';
  end if;
  select timezone into target_tz from profiles where id = p_target;
  if extract(hour from now() at time zone coalesce(nullif(target_tz, ''), 'UTC')) >= 21 then
    raise exception 'target_quiet_hours';
  end if;
  insert into taunts (sender_id, target_id, line_id) values (uid, p_target, p_line_id) returning id into taunt_id;
  insert into notifications (recipient_id, actor_id, type, payload)
  values (p_target, uid, 'taunt', jsonb_build_object('text', left(p_line_text, 140), 'taunt_id', taunt_id));
  return taunt_id;
end; $$;
grant execute on function public.send_taunt_line(uuid, text, text, timestamptz) to authenticated;

create or replace function public.answer_taunts_on_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  for t in
    select id, sender_id from taunts
    where target_id = new.user_id and answered_post_id is null and sent_at > now() - interval '3 hours'
  loop
    update taunts set answered_post_id = new.id where id = t.id;
    insert into notifications (recipient_id, actor_id, type, payload)
    values (t.sender_id, new.user_id, 'taunt_answered', jsonb_build_object('post_id', new.id, 'taunt_id', t.id));
  end loop;
  return new;
exception when others then
  return new;
end; $$;
drop trigger if exists posts_answer_taunts on public.posts;
create trigger posts_answer_taunts after insert on public.posts
  for each row execute function public.answer_taunts_on_post();

-- ============ Spec C: trophy feed events + featured trophies ============
create table if not exists public.trophy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  icon text not null,
  name text not null,
  family_name text,
  rarity_pct double precision,
  created_at timestamptz not null default now()
);
create index if not exists trophy_events_user_idx on public.trophy_events (user_id, created_at desc);
alter table public.trophy_events enable row level security;
drop policy if exists trophy_events_select on public.trophy_events;
create policy trophy_events_select on public.trophy_events
  for select using (user_id = (select auth.uid()) or are_friends((select auth.uid()), user_id));
drop policy if exists trophy_events_insert_self on public.trophy_events;
create policy trophy_events_insert_self on public.trophy_events
  for insert with check (user_id = (select auth.uid()));

alter table public.profiles add column if not exists featured_trophies jsonb not null default '[]'::jsonb;

-- ============ Spec D: lift trophy claims + admin review ============
create table if not exists public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.admin_users enable row level security;
drop policy if exists admin_users_select_self on public.admin_users;
create policy admin_users_select_self on public.admin_users
  for select using (user_id = (select auth.uid()));
insert into public.admin_users (user_id)
select id from public.profiles where username = 'octavio' on conflict do nothing;

create table if not exists public.trophy_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  trophy_id text not null,
  claimed_value double precision not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reason_id text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists trophy_claims_status_idx on public.trophy_claims (status, created_at);
create index if not exists trophy_claims_user_idx on public.trophy_claims (user_id, created_at desc);
alter table public.trophy_claims enable row level security;
drop policy if exists trophy_claims_select on public.trophy_claims;
create policy trophy_claims_select on public.trophy_claims
  for select using (
    user_id = (select auth.uid())
    or exists (select 1 from admin_users a where a.user_id = (select auth.uid()))
  );
drop policy if exists trophy_claims_insert_self on public.trophy_claims;
create policy trophy_claims_insert_self on public.trophy_claims
  for insert with check (user_id = (select auth.uid()));

create or replace function public.review_trophy_claim(p_claim uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c record;
begin
  if uid is null or not exists (select 1 from admin_users where user_id = uid) then
    raise exception 'not_admin';
  end if;
  select * into c from trophy_claims where id = p_claim and status = 'pending';
  if c is null then raise exception 'claim_not_pending'; end if;
  update trophy_claims
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewer_id = uid, reason_id = p_reason, reviewed_at = now()
  where id = p_claim;
  if p_approve then
    insert into user_lifts (user_id, exercise, value, unit, post_id)
    values (c.user_id, c.trophy_id, c.claimed_value,
      case when c.trophy_id in ('pullups', 'pushups') then 'reps' else 'lb' end, c.post_id);
    insert into notifications (recipient_id, actor_id, type, payload)
    values (c.user_id, uid, 'claim_approved',
      jsonb_build_object('trophy_id', c.trophy_id, 'value', c.claimed_value, 'claim_id', c.id));
  else
    insert into notifications (recipient_id, actor_id, type, payload)
    values (c.user_id, uid, 'claim_rejected',
      jsonb_build_object('trophy_id', c.trophy_id, 'reason', coalesce(p_reason, 'not_verifiable'), 'claim_id', c.id));
  end if;
end; $$;
grant execute on function public.review_trophy_claim(uuid, boolean, text) to authenticated;
