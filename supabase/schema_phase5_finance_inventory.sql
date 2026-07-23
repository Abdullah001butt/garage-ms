-- Al Bahir Garage — Phase 5: Advanced finance & inventory
-- Run this in the Supabase SQL editor after schema_phase4_inventory_appointments.sql

-- Shop settings (singleton row used on invoice headers)
create table if not exists shop_settings (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null default 'Al Bahir Garage',
  trn text,
  address text,
  phone text,
  vat_rate numeric not null default 5,
  created_at timestamptz not null default now()
);

insert into shop_settings (shop_name, vat_rate)
select 'Al Bahir Garage', 5
where not exists (select 1 from shop_settings);

-- Estimates vs invoices, on the same table
alter table invoices add column if not exists document_type text not null default 'invoice'
  check (document_type in ('estimate', 'invoice'));
alter table invoices add column if not exists vat_rate numeric not null default 5;
alter table invoices add column if not exists converted_from_estimate_id uuid references invoices(id);

-- Link invoice line items to parts (enables live stock decrement)
alter table invoice_items add column if not exists part_id uuid references parts(id);

-- Reorder threshold per part
alter table parts add column if not exists reorder_threshold int not null default 5;

-- Expenses
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount numeric not null,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on expenses(expense_date);

-- Purchase orders (automated reordering)
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references parts(id) on delete cascade,
  quantity int not null,
  status text not null default 'pending' check (status in ('pending', 'ordered', 'received', 'cancelled')),
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create index if not exists purchase_orders_part_id_idx on purchase_orders(part_id);
create index if not exists purchase_orders_status_idx on purchase_orders(status);

-- Auto-decrement stock when a part is billed on an invoice
create or replace function decrement_part_stock() returns trigger as $$
begin
  if new.part_id is not null then
    update parts set stock_qty = stock_qty - new.quantity where id = new.part_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_decrement_part_stock on invoice_items;
create trigger trg_decrement_part_stock
  after insert on invoice_items
  for each row execute function decrement_part_stock();

-- Auto-increment stock when a purchase order is marked received
create or replace function increment_part_stock_on_receive() returns trigger as $$
begin
  if new.status = 'received' and old.status is distinct from 'received' then
    update parts set stock_qty = stock_qty + new.quantity where id = new.part_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_increment_part_stock on purchase_orders;
create trigger trg_increment_part_stock
  after update on purchase_orders
  for each row execute function increment_part_stock_on_receive();

alter table shop_settings enable row level security;
alter table expenses enable row level security;
alter table purchase_orders enable row level security;

create policy "Allow all for now (shop_settings)" on shop_settings for all using (true) with check (true);
create policy "Allow all for now (expenses)" on expenses for all using (true) with check (true);
create policy "Allow all for now (purchase_orders)" on purchase_orders for all using (true) with check (true);
