-- Allow reporting whole communities (community settings → Report community).
alter table public.reports drop constraint if exists reports_content_type_check;
alter table public.reports add constraint reports_content_type_check
  check (content_type in ('post','story','user','comment','community'));
