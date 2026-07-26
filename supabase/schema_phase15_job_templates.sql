-- Al Bahir Garage — Phase 15: Quick job templates

create table if not exists job_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists job_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references job_templates(id) on delete cascade,
  description text not null,
  item_type text not null default 'part' check (item_type in ('part', 'labor')),
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  sort_order int not null default 0
);

create index if not exists job_template_items_template_id_idx on job_template_items(template_id);

alter table job_templates enable row level security;
alter table job_template_items enable row level security;

create policy "Staff access (job_templates)" on job_templates for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Staff access (job_template_items)" on job_template_items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
