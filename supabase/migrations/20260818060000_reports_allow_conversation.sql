-- "Report chat" (IG-style ⋯ action in group DMs) files a report against the
-- conversation itself.
alter table public.reports drop constraint reports_content_type_check;
alter table public.reports add constraint reports_content_type_check
  check (content_type in ('post', 'story', 'user', 'comment', 'community', 'conversation'));
