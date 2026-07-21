-- 0009_avatar_webhook.sql
-- avatar-process was never invoked by anything: wire a storage trigger so every
-- avatar upload generates the blurred variant used by the free-tier viewer list.

create or replace function public.enqueue_avatar_process()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.bucket_id = 'avatars' and new.name like '%/avatar.%' then
    perform net.http_post(
      url := 'https://nvywxqntsrlrmlrpfuub.supabase.co/functions/v1/avatar-process',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eXd4cW50c3Jscm1scnBmdXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTY2NjcsImV4cCI6MjA5Mjk5MjY2N30.xTaKHGBjL4w_P8nORyS85r3gguETo8iZSORLEA6k4Bc'
      ),
      body := jsonb_build_object('name', new.name)
    );
  end if;
  return new;
exception when others then
  return new;
end;
$$;

revoke execute on function public.enqueue_avatar_process() from public, anon, authenticated;

drop trigger if exists avatars_process on storage.objects;
create trigger avatars_process
  after insert on storage.objects
  for each row execute function public.enqueue_avatar_process();
