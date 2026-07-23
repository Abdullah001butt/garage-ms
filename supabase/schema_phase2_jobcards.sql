-- Al Bahir Garage — Phase 2: Job cards / work orders
-- Run this in the Supabase SQL editor after schema.sql

create table if not exists job_cards (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  description text not null,
  mechanic_name text,
  odometer int,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists job_cards_vehicle_id_idx on job_cards(vehicle_id);
create index if not exists job_cards_customer_id_idx on job_cards(customer_id);
create index if not exists job_cards_status_idx on job_cards(status);

alter table job_cards enable row level security;

create policy "Allow all for now (job_cards)"
  on job_cards for all
  using (true)
  with check (true);
