create sequence if not exists invoice_number_seq start 1;

alter table invoices add column if not exists invoice_number integer;

create or replace function assign_invoice_number()
returns trigger as $$
begin
  if new.document_type = 'invoice' and new.invoice_number is null then
    new.invoice_number := nextval('invoice_number_seq');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assign_invoice_number on invoices;
create trigger trg_assign_invoice_number
before insert or update on invoices
for each row execute function assign_invoice_number();

-- Backfill existing invoices in chronological order so history stays sequential.
with numbered as (
  select id, row_number() over (order by created_at) as rn
  from invoices
  where document_type = 'invoice'
)
update invoices i
set invoice_number = numbered.rn
from numbered
where i.id = numbered.id and i.invoice_number is null;

select setval(
  'invoice_number_seq',
  greatest(1, (select coalesce(max(invoice_number), 0) from invoices)),
  (select coalesce(max(invoice_number), 0) from invoices) > 0
);
