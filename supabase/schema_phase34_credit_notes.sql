-- Al Bahir Garage — Phase 34: credit notes and refunds
-- A credit note reduces what a customer owes on an invoice (and its VAT).
-- A refund is money handed back: stored as a negative payment so cash reports net it automatically.

create sequence if not exists credit_note_seq start 1;

create table if not exists credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_number integer not null default nextval('credit_note_seq'),
  invoice_id uuid not null references invoices(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  amount numeric not null check (amount > 0),           -- including VAT
  vat_amount numeric not null default 0,                -- VAT part of amount
  reason text not null,
  refund_amount numeric not null default 0,
  refund_method text,
  restocked boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists credit_notes_invoice_idx on credit_notes(invoice_id);
create index if not exists credit_notes_created_idx on credit_notes(created_at);

alter table credit_notes enable row level security;
drop policy if exists "Owner only (credit_notes)" on credit_notes;
create policy "Owner only (credit_notes)" on credit_notes for all using (is_owner()) with check (is_owner());

-- Fully credited invoices get their own status.
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check check (status in ('unpaid', 'partial', 'paid', 'credited'));

-- Refunds are negative payments.
alter table payments drop constraint if exists payments_amount_check;
alter table payments add constraint payments_amount_check check (amount <> 0);
alter table payments add column if not exists credit_note_id uuid references credit_notes(id) on delete cascade;

-- Parts returned to the shelf by a credit note (logged in stock history).
create or replace function return_part_stock(p_part_id uuid, p_quantity numeric, p_credit_note uuid) returns void as $$
begin
  perform set_config('app.stock_reason', 'credit_note', true);
  perform set_config('app.stock_ref_type', 'credit_note', true);
  perform set_config('app.stock_ref', p_credit_note::text, true);
  update parts set stock_qty = stock_qty + p_quantity where id = p_part_id;
end;
$$ language plpgsql;
