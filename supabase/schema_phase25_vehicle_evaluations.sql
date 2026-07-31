create table if not exists vehicle_evaluations (
  id uuid primary key default gen_random_uuid(),
  ref_number text unique,
  evaluation_date date not null default current_date,

  customer_id uuid references customers(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,

  customer_name text not null,
  customer_location text,
  customer_phone text,
  customer_ref text,

  make_model text not null,
  registration_no text,
  year_of_manufacture text,
  color text,
  mileage_odo text,
  chassis_no text,
  ownership text,
  engine_no text,
  date_of_last_service text,
  type_of_vehicle text,
  accident_history text,
  no_of_doors text,
  no_of_cylinders text,
  service_history text,
  warranty_remaining text,
  transmission text,
  empty_weight text,
  specification_origin text,
  gross_weight text,
  remote text,

  inspection_items jsonb not null default '[]',

  estimated_value_min numeric(12, 2),
  estimated_value_max numeric(12, 2),
  valuator_name text,
  fee_amount numeric(12, 2),

  created_at timestamptz not null default now()
);

create sequence if not exists vehicle_evaluation_number_seq start 1;

create or replace function assign_vehicle_evaluation_ref()
returns trigger as $$
begin
  if new.ref_number is null then
    new.ref_number := 'ABVR0E-' || to_char(new.evaluation_date, 'DDMMYY') || '-' ||
      lpad(nextval('vehicle_evaluation_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assign_vehicle_evaluation_ref on vehicle_evaluations;
create trigger trg_assign_vehicle_evaluation_ref
before insert on vehicle_evaluations
for each row execute function assign_vehicle_evaluation_ref();

alter table vehicle_evaluations enable row level security;

create policy "Allow all for now (vehicle_evaluations)" on vehicle_evaluations
  for all using (true) with check (true);
