-- Al Bahir Garage — Phase 5b: fixes
-- Only decrement stock for real invoices (not estimates), and add an RPC
-- to decrement stock when an estimate with parts is converted to an invoice.

create or replace function decrement_part_stock() returns trigger as $$
declare
  doc_type text;
begin
  if new.part_id is not null then
    select document_type into doc_type from invoices where id = new.invoice_id;
    if doc_type = 'invoice' then
      update parts set stock_qty = stock_qty - new.quantity where id = new.part_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function decrement_stock(p_part_id uuid, p_quantity numeric) returns void as $$
begin
  update parts set stock_qty = stock_qty - p_quantity where id = p_part_id;
end;
$$ language plpgsql;
