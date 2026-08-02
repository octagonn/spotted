-- Follow-up advisor hardening: avoid per-row auth function evaluation, keep
-- the scheduled cleanup RPC private, and cover the delivery-user foreign key.

drop policy if exists legal_acceptances_select_own on public.legal_acceptances;
create policy legal_acceptances_select_own
  on public.legal_acceptances
  for select
  using (user_id = (select auth.uid()));

revoke all on function public.notifications_cleanup_sweep()
  from public, anon, authenticated;
grant execute on function public.notifications_cleanup_sweep()
  to service_role;

create index if not exists push_deliveries_user_idx
  on public.push_deliveries (user_id);
