-- Al Bahir Garage — Phase 30: staff advances & salary sheet, supplier accounts, counter sales
-- Run this in the Supabase SQL editor after schema_phase29_fix_evaluation_rls.sql

-- Cash advances given to staff during the month (deducted from that month's salary).
-- Each advance is also written to expenses (category "Salaries") so cash flow and P&L see it the day it is paid.
create table if not exists staff_advances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  advance_date date not null default (now() at time zone 'Asia/Dubai')::date,
  note text,
  expense_id uuid references expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists staff_advances_profile_date_idx on staff_advances(profile_id, advance_date);

-- One row per person per month once the salary has been paid (the month is then "closed" for them).
create table if not exists salary_payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  base_salary numeric not null default 0,
  working_days int not null default 0,
  absent_days int not null default 0,
  absence_deduction numeric not null default 0,
  advances numeric not null default 0,
  bonus numeric not null default 0,
  other_deduction numeric not null default 0,
  net_pay numeric not null default 0,
  method text not null default 'cash',
  note text,
  expense_id uuid references expenses(id) on delete set null,
  paid_at timestamptz not null default now(),
  unique (profile_id, month)
);

-- Suppliers (spare-parts shops etc.) and their running account: purchases on credit and payments made.
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  contact_person text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists supplier_entries (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  kind text not null check (kind in ('purchase', 'payment')),
  amount numeric not null check (amount > 0),
  entry_date date not null default (now() at time zone 'Asia/Dubai')::date,
  reference text,
  note text,
  expense_id uuid references expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists supplier_entries_supplier_idx on supplier_entries(supplier_id, entry_date);

-- Counter sales are normal paid invoices billed to one shared "Walk-in customer",
-- so VAT, cash flow, P&L and stock all keep working without special cases.
alter table customers add column if not exists is_walk_in boolean not null default false;

insert into customers (name, phone, notes, is_walk_in)
select 'Walk-in customer', '-', 'Counter sales without a named customer', true
where not exists (select 1 from customers where is_walk_in);

alter table staff_advances enable row level security;
alter table salary_payments enable row level security;
alter table suppliers enable row level security;
alter table supplier_entries enable row level security;

drop policy if exists "Owner only (staff_advances)" on staff_advances;
create policy "Owner only (staff_advances)" on staff_advances for all using (is_owner()) with check (is_owner());

drop policy if exists "Owner only (salary_payments)" on salary_payments;
create policy "Owner only (salary_payments)" on salary_payments for all using (is_owner()) with check (is_owner());

drop policy if exists "Owner only (suppliers)" on suppliers;
create policy "Owner only (suppliers)" on suppliers for all using (is_owner()) with check (is_owner());

drop policy if exists "Owner only (supplier_entries)" on supplier_entries;
create policy "Owner only (supplier_entries)" on supplier_entries for all using (is_owner()) with check (is_owner());
