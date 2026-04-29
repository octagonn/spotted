create type subscription_tier as enum ('free','plus');

alter table profiles
  add column subscription_tier subscription_tier not null default 'free',
  add column subscription_expires_at timestamptz,
  add column premium_since timestamptz;

create table iap_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id text not null,
  transaction_id text not null unique,
  original_transaction_id text,
  purchased_at timestamptz not null,
  expires_at timestamptz,
  is_subscription boolean not null,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table consumable_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id text not null,
  granted_at timestamptz not null default now(),
  consumed_at timestamptz
);

alter table posts add column saved boolean not null default false;

alter table iap_receipts enable row level security;
create policy iap_receipts_select_self on iap_receipts for select using (user_id = auth.uid());

alter table consumable_grants enable row level security;
create policy consumable_grants_select_self on consumable_grants for select using (user_id = auth.uid());
