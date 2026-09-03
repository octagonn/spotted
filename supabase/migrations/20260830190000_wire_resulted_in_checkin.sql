-- Wire up notification → check-in attribution. `resulted_in_checkin` was
-- created in 20260726160000 with default false and NOTHING ever set it —
-- client, edge functions, and DB alike — so the metric read as "push drives
-- zero check-ins" when it was simply unmeasured.
--
-- Attribution model: a check-in credits every notification the same user
-- OPENED in the 60 minutes before checking in (click-through attribution).
-- Unopened deliveries are never credited.
create or replace function public.attribute_checkin_to_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    update public.notification_log
      set resulted_in_checkin = true
      where user_id = new.user_id
        and resulted_in_checkin = false
        and opened_at is not null
        and opened_at >= coalesce(new.checked_in_at, now()) - interval '60 minutes'
        and opened_at <= coalesce(new.checked_in_at, now());
  exception when others then
    -- Attribution must never block a check-in.
    null;
  end;
  return new;
end;
$$;

drop trigger if exists checkins_attribute_notifications on public.checkins;
create trigger checkins_attribute_notifications
  after insert on public.checkins
  for each row execute function public.attribute_checkin_to_notifications();
