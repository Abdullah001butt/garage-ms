-- Al Bahir Garage — Phase 6: Staff logins & roles, recurring expenses, VAT reporting
-- Run this in the Supabase SQL editor after schema_phase5b_fixes.sql

-- Staff profiles, one row per auth.users account
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'receptionist' check (role in ('owner', 'receptionist', 'mechanic')),
  created_at timestamptz not null default now()
);

create or replace function is_owner() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'owner'
  );
$$ language sql security definer stable;

-- Recurring expense templates
create table if not exists expense_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount numeric not null,
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table expenses add column if not exists template_id uuid references expense_templates(id);
alter table expenses add column if not exists generated_month date;

create unique index if not exists expenses_template_month_unique
  on expenses(template_id, generated_month)
  where template_id is not null;

alter table profiles enable row level security;
alter table expense_templates enable row level security;

-- Anyone signed in can read their own profile (to know their role);
-- only an owner can read/manage all profiles.
drop policy if exists "Read own or owner reads all (profiles)" on profiles;
create policy "Read own or owner reads all (profiles)"
  on profiles for select
  using (auth.uid() = id or is_owner());

drop policy if exists "Owner manages profiles" on profiles;
create policy "Owner manages profiles"
  on profiles for insert
  with check (is_owner());

drop policy if exists "Owner updates profiles" on profiles;
create policy "Owner updates profiles"
  on profiles for update
  using (is_owner())
  with check (is_owner());

drop policy if exists "Owner deletes profiles" on profiles;
create policy "Owner deletes profiles"
  on profiles for delete
  using (is_owner());

create policy "Allow all for now (expense_templates)"
  on expense_templates for all
  using (true)
  with check (true);

-- Replace the wide-open policies from earlier phases:
-- operational tables -> any signed-in staff member
-- financial tables -> owner only

drop policy if exists "Allow all for now (customers)" on customers;
create policy "Staff access (customers)" on customers for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow all for now (vehicles)" on vehicles;
create policy "Staff access (vehicles)" on vehicles for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow all for now (job_cards)" on job_cards;
create policy "Staff access (job_cards)" on job_cards for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow all for now (appointments)" on appointments;
create policy "Staff access (appointments)" on appointments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow all for now (parts)" on parts;
create policy "Staff access (parts)" on parts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow all for now (purchase_orders)" on purchase_orders;
create policy "Staff read, owner writes (purchase_orders)" on purchase_orders for select
  using (auth.role() = 'authenticated');
create policy "Owner writes (purchase_orders insert)" on purchase_orders for insert
  with check (is_owner());
create policy "Owner writes (purchase_orders update)" on purchase_orders for update
  using (is_owner()) with check (is_owner());
create policy "Owner writes (purchase_orders delete)" on purchase_orders for delete
  using (is_owner());

drop policy if exists "Allow all for now (invoices)" on invoices;
create policy "Owner only (invoices)" on invoices for all
  using (is_owner()) with check (is_owner());

drop policy if exists "Allow all for now (invoice_items)" on invoice_items;
create policy "Owner only (invoice_items)" on invoice_items for all
  using (is_owner()) with check (is_owner());

drop policy if exists "Allow all for now (expenses)" on expenses;
create policy "Owner only (expenses)" on expenses for all
  using (is_owner()) with check (is_owner());

drop policy if exists "Allow all for now (shop_settings)" on shop_settings;
create policy "Owner only (shop_settings)" on shop_settings for all
  using (is_owner()) with check (is_owner());
