-- Allow a generic "service" item type (covers towing, recovery, diagnostic fees, etc.)
alter table invoice_items drop constraint if exists invoice_items_item_type_check;
alter table invoice_items add constraint invoice_items_item_type_check
  check (item_type in ('part', 'labor', 'service'));

alter table job_template_items drop constraint if exists job_template_items_item_type_check;
alter table job_template_items add constraint job_template_items_item_type_check
  check (item_type in ('part', 'labor', 'service'));

-- Customer running balance / credit ledger (carried-forward balances, credit notes)
create table if not exists customer_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  amount numeric(10, 2) not null,
  note text not null,
  created_at timestamptz not null default now()
);

alter table customer_balance_adjustments enable row level security;

create policy "Authenticated staff can read balance adjustments"
  on customer_balance_adjustments for select
  to authenticated
  using (true);

create policy "Authenticated staff can insert balance adjustments"
  on customer_balance_adjustments for insert
  to authenticated
  with check (true);

create policy "Authenticated staff can delete balance adjustments"
  on customer_balance_adjustments for delete
  to authenticated
  using (true);

-- Sublet / outsourced job costs (paid to third-party specialist garages)
create table if not exists job_sublets (
  id uuid primary key default gen_random_uuid(),
  job_card_id uuid not null references job_cards(id) on delete cascade,
  vendor_name text not null,
  description text not null,
  cost numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

alter table job_sublets enable row level security;

create policy "Authenticated staff can read job sublets"
  on job_sublets for select
  to authenticated
  using (true);

create policy "Authenticated staff can insert job sublets"
  on job_sublets for insert
  to authenticated
  with check (true);

create policy "Authenticated staff can delete job sublets"
  on job_sublets for delete
  to authenticated
  using (true);
