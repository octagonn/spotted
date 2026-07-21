-- 0007_performance.sql
-- Addresses Supabase performance advisor findings (2026-07-03):
--   1. auth_rls_initplan — 42 policies re-evaluated auth.uid()/auth.jwt() per row;
--      wrapping in a scalar subquery lets the planner evaluate once per statement.
--   2. multiple_permissive_policies — three FOR ALL policies overlapped the SELECT
--      policies on gyms / streaks / workout_schedule; split into write-only policies.
--   3. unindexed_foreign_keys — covering indexes for FK lookups on hot paths.

-- 2. Split FOR ALL write policies so they no longer stack on SELECT
drop policy if exists gyms_admin_write on public.gyms;
create policy gyms_admin_insert on public.gyms for insert
  with check (((select auth.jwt()) ->> 'app_role') = 'admin');
create policy gyms_admin_update on public.gyms for update
  using (((select auth.jwt()) ->> 'app_role') = 'admin')
  with check (((select auth.jwt()) ->> 'app_role') = 'admin');
create policy gyms_admin_delete on public.gyms for delete
  using (((select auth.jwt()) ->> 'app_role') = 'admin');

drop policy if exists streaks_write_self on public.streaks;
create policy streaks_insert_self on public.streaks for insert
  with check (user_id = (select auth.uid()));
create policy streaks_update_self on public.streaks for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy streaks_delete_self on public.streaks for delete
  using (user_id = (select auth.uid()));

drop policy if exists schedule_write_self on public.workout_schedule;
create policy schedule_insert_self on public.workout_schedule for insert
  with check (user_id = (select auth.uid()));
create policy schedule_update_self on public.workout_schedule for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy schedule_delete_self on public.workout_schedule for delete
  using (user_id = (select auth.uid()));

-- 1. Rewrite every remaining policy that calls auth.uid()/auth.jwt() inline
do $$
declare
  r record;
  cmd text;
  new_qual text;
  new_check text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
        or coalesce(qual, '') like '%auth.jwt()%'
        or coalesce(with_check, '') like '%auth.jwt()%')
  loop
    cmd := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then
      new_qual := replace(replace(r.qual, 'auth.uid()', '(select auth.uid())'), 'auth.jwt()', '(select auth.jwt())');
      cmd := cmd || format(' using (%s)', new_qual);
    end if;
    if r.with_check is not null then
      new_check := replace(replace(r.with_check, 'auth.uid()', '(select auth.uid())'), 'auth.jwt()', '(select auth.jwt())');
      cmd := cmd || format(' with check (%s)', new_check);
    end if;
    execute cmd;
  end loop;
end $$;

-- 3. Covering indexes for unindexed foreign keys
create index if not exists idx_consumable_grants_user on public.consumable_grants (user_id);
create index if not exists idx_conversations_participant_b on public.conversations (participant_b);
create index if not exists idx_iap_receipts_user on public.iap_receipts (user_id);
create index if not exists idx_messages_conversation_sent on public.messages (conversation_id, sent_at desc);
create index if not exists idx_messages_sender on public.messages (sender_id);
create index if not exists idx_notifications_actor on public.notifications (actor_id);
create index if not exists idx_post_reactions_user on public.post_reactions (user_id);
create index if not exists idx_post_views_viewer on public.post_views (viewer_id);
create index if not exists idx_posts_gym on public.posts (gym_id);
