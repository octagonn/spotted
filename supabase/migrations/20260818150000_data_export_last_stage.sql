-- Data export diagnostics: the export-data edge function writes its current
-- step here as it runs (gather:<table> / sign_media / zip / email / done, or
-- "failed at <stage>: <provider error>"). Supabase's function-log API was
-- unavailable while building the export, and a killed isolate never reaches
-- its own catch block — this column makes any future failure diagnosable
-- straight from the row.
alter table public.data_export_requests add column if not exists last_stage text;
