-- Company-owned vehicles (parts-run vans, recovery trucks) and their running costs
create table if not exists company_vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate_number text,
  notes text,
  created_at timestamptz not null default now()
);

alter table company_vehicles enable row level security;
create policy "Authenticated staff can manage company vehicles"
  on company_vehicles for all
  to authenticated
  using (true)
  with check (true);

alter table expenses add column if not exists company_vehicle_id uuid references company_vehicles(id) on delete set null;

-- Shop working calendar (Fridays, official holidays)
create table if not exists shop_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  label text not null,
  created_at timestamptz not null default now()
);

alter table shop_holidays enable row level security;
create policy "Authenticated staff can manage shop holidays"
  on shop_holidays for all
  to authenticated
  using (true)
  with check (true);

-- Vehicle Passport: permanent record tied to the vehicle, independent of current owner
create table if not exists vehicle_incidents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  incident_date date not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table vehicle_incidents enable row level security;
create policy "Authenticated staff can manage vehicle incidents"
  on vehicle_incidents for all
  to authenticated
  using (true)
  with check (true);

create table if not exists vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);

alter table vehicle_documents enable row level security;
create policy "Authenticated staff can manage vehicle documents"
  on vehicle_documents for all
  to authenticated
  using (true)
  with check (true);

-- Storage bucket for vehicle photos/documents
insert into storage.buckets (id, name, public)
values ('vehicle-files', 'vehicle-files', true)
on conflict (id) do nothing;

create policy "Authenticated staff can upload vehicle files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vehicle-files');

create policy "Authenticated staff can delete vehicle files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vehicle-files');

create policy "Anyone can view vehicle files"
  on storage.objects for select
  to public
  using (bucket_id = 'vehicle-files');

-- Seed a Recovery/Towing quick job template
insert into job_templates (name, description)
select 'Recovery / Towing', 'Vehicle recovery / towing service'
where not exists (select 1 from job_templates where name = 'Recovery / Towing');

insert into job_template_items (template_id, description, item_type, quantity, unit_price, sort_order)
select id, 'Recovery / Towing', 'service', 1, 150, 0
from job_templates
where name = 'Recovery / Towing'
  and not exists (
    select 1 from job_template_items where template_id = job_templates.id
  );
