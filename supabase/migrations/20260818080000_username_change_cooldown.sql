-- Username changes from Edit Profile: allowed once every 30 days, format
-- server-enforced. The first-ever change is free (username_changed_at is
-- stamped only when the name actually changes).
alter table public.profiles add column if not exists username_changed_at timestamptz;

create or replace function public.enforce_username_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.username is distinct from old.username then
    if new.username is null or new.username !~ '^[a-z0-9_]{3,20}$' then
      raise exception 'username_invalid';
    end if;
    if old.username_changed_at is not null and old.username_changed_at > now() - interval '30 days' then
      raise exception 'username_cooldown';
    end if;
    new.username_changed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists profiles_username_rules on public.profiles;
create trigger profiles_username_rules before update on public.profiles
  for each row execute function enforce_username_rules();
