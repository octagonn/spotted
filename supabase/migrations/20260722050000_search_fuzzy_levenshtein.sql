-- Trigram similarity under-scores short transposed names ("ehtan" vs "ethan"
-- = 0.2). Add Levenshtein (fuzzystrmatch) for short-string typo tolerance and
-- lower the trigram floor slightly.
create extension if not exists fuzzystrmatch with schema extensions;

create or replace function public.search_profiles_fuzzy(q text, max_rows int default 20)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with scored as (
    select p.id, p.username, p.display_name, p.avatar_url,
      greatest(
        similarity(p.username, q),
        similarity(p.display_name, q),
        case when p.username ilike q || '%' then 1.0 else 0 end,
        case when p.username ilike '%' || q || '%' or p.display_name ilike '%' || q || '%' then 0.6 else 0 end,
        -- Typo tolerance: 1 edit for short queries, 2 for 6+ chars.
        case when levenshtein(lower(p.username), lower(q)) <= (case when length(q) >= 6 then 2 else 1 end) then 0.7 else 0 end,
        case when levenshtein(lower(split_part(p.display_name, ' ', 1)), lower(q)) <= (case when length(q) >= 6 then 2 else 1 end) then 0.65 else 0 end
      ) as score
    from profiles p
    where p.discoverable = true
  )
  select s.id, s.username, s.display_name, s.avatar_url
  from scored s
  where s.score >= 0.2
  order by s.score desc
  limit max_rows;
$$;
