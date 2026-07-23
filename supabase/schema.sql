-- Al Bahir Garage — v1 schema: Customers & Vehicles
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)

create extension if not exists "pgcrypto";

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  plate_number text not null,
  make text,
  model text,
  year int,
  color text,
  vin text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists vehicles_customer_id_idx on vehicles(customer_id);
create index if not exists customers_phone_idx on customers(phone);
create index if not exists vehicles_plate_idx on vehicles(plate_number);

-- Row Level Security: temporarily open (no login flow yet in v1).
-- TODO: once staff login is added, replace `using (true)` with
-- `using (auth.role() = 'authenticated')` on both policies below.
alter table customers enable row level security;
alter table vehicles enable row level security;

create policy "Allow all for now (customers)"
  on customers for all
  using (true)
  with check (true);

create policy "Allow all for now (vehicles)"
  on vehicles for all
  using (true)
  with check (true);
