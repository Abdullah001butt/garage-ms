create table if not exists daily_cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  reconciliation_date date not null unique,
  counted_cash numeric(10, 2) not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table daily_cash_reconciliations enable row level security;

create policy "Authenticated staff can manage cash reconciliations"
  on daily_cash_reconciliations for all
  to authenticated
  using (true)
  with check (true);
