-- Al Bahir Garage — Phase 8: Partial payments, partner profit-share, staff attendance
-- Run this in the Supabase SQL editor after schema_phase7b_portal_url.sql

-- Partial payments against an invoice (replaces single paid/unpaid flip)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash', 'card', 'bank_transfer', 'ziina', 'other')),
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payments_invoice_id_idx on payments(invoice_id);
create index if not exists payments_paid_at_idx on payments(paid_at);

alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check check (status in ('unpaid', 'partial', 'paid'));

-- Partners (profit-sharing)
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  share_percentage numeric not null check (share_percentage >= 0 and share_percentage <= 100),
  created_at timestamptz not null default now()
);

-- Staff attendance + salary
alter table profiles add column if not exists monthly_salary numeric;

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  attendance_date date not null,
  status text not null default 'present' check (status in ('present', 'absent', 'paid_leave', 'holiday')),
  created_at timestamptz not null default now(),
  unique (profile_id, attendance_date)
);

create index if not exists attendance_date_idx on attendance(attendance_date);

alter table payments enable row level security;
alter table partners enable row level security;
alter table attendance enable row level security;

create policy "Owner only (payments)" on payments for all
  using (is_owner()) with check (is_owner());

create policy "Owner only (partners)" on partners for all
  using (is_owner()) with check (is_owner());

create policy "Owner manages, staff read own (attendance)" on attendance for select
  using (is_owner() or profile_id = auth.uid());
create policy "Owner writes (attendance insert)" on attendance for insert
  with check (is_owner());
create policy "Owner writes (attendance update)" on attendance for update
  using (is_owner()) with check (is_owner());
create policy "Owner writes (attendance delete)" on attendance for delete
  using (is_owner());
