-- Al Bahir Garage — Phase 35: inline editing of invoice lines + personal dashboard layouts

-- Editing a part line's quantity (or swapping the part) on an invoice moves stock by the difference,
-- the same way adding and removing lines already does.
create or replace function sync_part_stock_on_item_update() returns trigger as $$
declare
  doc_type text;
begin
  if old.part_id is not distinct from new.part_id and old.quantity = new.quantity then
    return new;
  end if;
  select document_type into doc_type from invoices where id = new.invoice_id;
  if doc_type is distinct from 'invoice' then
    return new;
  end if;

  perform set_config('app.stock_ref_type', 'invoice', true);
  perform set_config('app.stock_ref', new.invoice_id::text, true);

  if old.part_id is not distinct from new.part_id then
    if new.part_id is not null then
      perform set_config('app.stock_reason', case when new.quantity > old.quantity then 'sale' else 'return' end, true);
      perform set_config('app.stock_note', 'Quantity changed on invoice', true);
      update parts set stock_qty = stock_qty - (new.quantity - old.quantity) where id = new.part_id;
    end if;
  else
    if old.part_id is not null then
      perform set_config('app.stock_reason', 'return', true);
      perform set_config('app.stock_note', 'Part swapped on invoice', true);
      update parts set stock_qty = stock_qty + old.quantity where id = old.part_id;
    end if;
    if new.part_id is not null then
      perform set_config('app.stock_reason', 'sale', true);
      perform set_config('app.stock_note', 'Part swapped on invoice', true);
      update parts set stock_qty = stock_qty - new.quantity where id = new.part_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_part_stock_on_item_update on invoice_items;
create trigger trg_sync_part_stock_on_item_update
  after update of quantity, part_id on invoice_items
  for each row execute function sync_part_stock_on_item_update();

-- Each person's own dashboard arrangement (order, sizes, hidden boxes).
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dashboard_layout jsonb,
  updated_at timestamptz not null default now()
);
alter table user_preferences enable row level security;
drop policy if exists "Own preferences read" on user_preferences;
create policy "Own preferences read" on user_preferences for select using (auth.uid() = user_id);
drop policy if exists "Own preferences insert" on user_preferences;
create policy "Own preferences insert" on user_preferences for insert with check (auth.uid() = user_id);
drop policy if exists "Own preferences update" on user_preferences;
create policy "Own preferences update" on user_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Own preferences delete" on user_preferences;
create policy "Own preferences delete" on user_preferences for delete using (auth.uid() = user_id);
