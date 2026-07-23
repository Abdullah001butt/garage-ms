-- Al Bahir Garage — Phase 4: Inventory & Appointments
-- Run this in the Supabase SQL editor after schema_phase3_invoicing.sql

create table if not exists parts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  stock_qty int not null default 0,
  unit_cost numeric,
  unit_price numeric,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  scheduled_at timestamptz not null,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists appointments_customer_id_idx on appointments(customer_id);
create index if not exists appointments_scheduled_at_idx on appointments(scheduled_at);
create index if not exists parts_sku_idx on parts(sku);

alter table parts enable row level security;
alter table appointments enable row level security;

create policy "Allow all for now (parts)"
  on parts for all
  using (true)
  with check (true);

create policy "Allow all for now (appointments)"
  on appointments for all
  using (true)
  with check (true);
