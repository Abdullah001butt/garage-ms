-- Al Bahir Garage — Phase 33: stock movement history + purchase orders linked to suppliers

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references parts(id) on delete cascade,
  change numeric not null,
  balance_after numeric,
  reason text not null default 'adjustment'
    check (reason in ('opening', 'sale', 'return', 'purchase', 'adjustment', 'credit_note')),
  reference_type text,
  reference_id uuid,
  note text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_part_idx on stock_movements(part_id, created_at desc);

alter table stock_movements enable row level security;
drop policy if exists "Staff read stock movements" on stock_movements;
create policy "Staff read stock movements" on stock_movements for select using (auth.uid() is not null);

-- Every change to parts.stock_qty is logged. Whoever changes stock can say why through
-- transaction-local settings (app.stock_reason / app.stock_ref_type / app.stock_ref / app.stock_note).
create or replace function log_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_reason text := coalesce(nullif(current_setting('app.stock_reason', true), ''), 'adjustment');
  v_ref_type text := nullif(current_setting('app.stock_ref_type', true), '');
  v_ref text := nullif(current_setting('app.stock_ref', true), '');
  v_note text := nullif(current_setting('app.stock_note', true), '');
begin
  if tg_op = 'INSERT' then
    if coalesce(new.stock_qty, 0) <> 0 then
      insert into stock_movements (part_id, change, balance_after, reason, note, actor_id, actor_name)
      values (new.id, new.stock_qty, new.stock_qty, 'opening', 'Opening stock', auth.uid(), (select full_name from profiles where id = auth.uid()));
    end if;
    return new;
  end if;
  if new.stock_qty is distinct from old.stock_qty then
    insert into stock_movements (part_id, change, balance_after, reason, reference_type, reference_id, note, actor_id, actor_name)
    values (
      new.id, new.stock_qty - old.stock_qty, new.stock_qty, v_reason, v_ref_type,
      case when v_ref ~ '^[0-9a-f-]{36}$' then v_ref::uuid end, v_note,
      auth.uid(), (select full_name from profiles where id = auth.uid())
    );
  end if;
  perform set_config('app.stock_reason', '', true);
  perform set_config('app.stock_ref_type', '', true);
  perform set_config('app.stock_ref', '', true);
  perform set_config('app.stock_note', '', true);
  return new;
end;
$$;

drop trigger if exists trg_log_stock_update on parts;
create trigger trg_log_stock_update after update of stock_qty on parts for each row execute function log_stock_movement();
drop trigger if exists trg_log_stock_insert on parts;
create trigger trg_log_stock_insert after insert on parts for each row execute function log_stock_movement();

-- Part billed on an invoice → stock out (reason: sale).
create or replace function decrement_part_stock() returns trigger as $$
declare
  doc_type text;
begin
  if new.part_id is not null then
    select document_type into doc_type from invoices where id = new.invoice_id;
    if doc_type = 'invoice' then
      perform set_config('app.stock_reason', 'sale', true);
      perform set_config('app.stock_ref_type', 'invoice', true);
      perform set_config('app.stock_ref', new.invoice_id::text, true);
      update parts set stock_qty = stock_qty - new.quantity where id = new.part_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- Part line removed from an invoice → back on the shelf (this was missing before).
create or replace function restore_part_stock() returns trigger as $$
declare
  doc_type text;
begin
  if old.part_id is not null then
    select document_type into doc_type from invoices where id = old.invoice_id;
    if doc_type = 'invoice' then
      perform set_config('app.stock_reason', 'return', true);
      perform set_config('app.stock_ref_type', 'invoice', true);
      perform set_config('app.stock_ref', old.invoice_id::text, true);
      perform set_config('app.stock_note', 'Line removed from invoice', true);
      update parts set stock_qty = stock_qty + old.quantity where id = old.part_id;
    end if;
  end if;
  return old;
end;
$$ language plpgsql;
drop trigger if exists trg_restore_part_stock on invoice_items;
create trigger trg_restore_part_stock after delete on invoice_items for each row execute function restore_part_stock();

-- Estimate converted to invoice → stock out.
create or replace function decrement_stock(p_part_id uuid, p_quantity numeric) returns void as $$
begin
  perform set_config('app.stock_reason', 'sale', true);
  perform set_config('app.stock_note', 'Estimate converted to invoice', true);
  update parts set stock_qty = stock_qty - p_quantity where id = p_part_id;
end;
$$ language plpgsql;

-- Manual count / correction with a note.
create or replace function adjust_part_stock(p_part_id uuid, p_new_qty numeric, p_note text default null) returns void as $$
begin
  perform set_config('app.stock_reason', 'adjustment', true);
  perform set_config('app.stock_note', coalesce(p_note, ''), true);
  update parts set stock_qty = p_new_qty where id = p_part_id;
end;
$$ language plpgsql;

-- Purchase orders: who we bought from and at what cost.
alter table purchase_orders add column if not exists supplier_id uuid references suppliers(id) on delete set null;
alter table purchase_orders add column if not exists unit_cost numeric;
alter table purchase_orders add column if not exists supplier_entry_id uuid references supplier_entries(id) on delete set null;

-- Received purchase order → stock in (reason: purchase).
create or replace function increment_part_stock_on_receive() returns trigger as $$
begin
  if new.status = 'received' and old.status is distinct from 'received' then
    perform set_config('app.stock_reason', 'purchase', true);
    perform set_config('app.stock_ref_type', 'purchase_order', true);
    perform set_config('app.stock_ref', new.id::text, true);
    update parts set stock_qty = stock_qty + new.quantity where id = new.part_id;
  end if;
  return new;
end;
$$ language plpgsql;

-- Starting point for history: today's quantity of every existing part.
insert into stock_movements (part_id, change, balance_after, reason, note)
select p.id, p.stock_qty, p.stock_qty, 'opening', 'Stock when history started'
from parts p
where not exists (select 1 from stock_movements m where m.part_id = p.id);
