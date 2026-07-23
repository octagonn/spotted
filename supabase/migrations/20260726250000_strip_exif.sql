-- §4 EXIF strip: fire strip-exif edge function on every new image-bucket
-- object. Server-side re-encode (decode->encode) discards all metadata.
-- Applied via MCP; mirrors deployed state. Trigger is INSERT-only, so the
-- re-encode upsert (an UPDATE) does not re-fire it.
create or replace function public.enqueue_exif_strip()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.bucket_id in ('posts','avatars','messages','reactions') then
    perform net.http_post(
      url := 'https://nvywxqntsrlrmlrpfuub.supabase.co/functions/v1/strip-exif',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('record', jsonb_build_object('bucket_id', new.bucket_id, 'name', new.name))
    );
  end if;
  return new;
exception when others then return new;
end; $$;
drop trigger if exists storage_objects_strip_exif on storage.objects;
create trigger storage_objects_strip_exif after insert on storage.objects
  for each row execute function public.enqueue_exif_strip();
