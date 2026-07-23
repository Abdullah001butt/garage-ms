-- Al Bahir Garage — Phase 3: Invoicing
-- Run this in the Supabase SQL editor after schema_phase2_jobcards.sql

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid references job_cards(id) on delete set null,
  customer_id uuid not null references customers(id) on delete cascade,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  item_type text not null default 'part' check (item_type in ('part', 'labor')),
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists invoices_customer_id_idx on invoices(customer_id);
create index if not exists invoices_job_card_id_idx on invoices(job_card_id);
create index if not exists invoice_items_invoice_id_idx on invoice_items(invoice_id);

alter table invoices enable row level security;
alter table invoice_items enable row level security;

create policy "Allow all for now (invoices)"
  on invoices for all
  using (true)
  with check (true);

create policy "Allow all for now (invoice_items)"
  on invoice_items for all
  using (true)
  with check (true);
