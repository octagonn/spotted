-- College / university behind a campus gym (rec centers, intramural buildings).
-- Slug keys ONE bundled logo per institution on the client, like gyms.chain.
-- Values are backfilled by scratchpad/institutions.py (reverse-geocoded).
alter table public.gyms add column if not exists institution text;
create index if not exists gyms_institution_idx on public.gyms (institution) where institution is not null;
