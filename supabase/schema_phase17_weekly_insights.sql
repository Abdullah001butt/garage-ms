create table if not exists weekly_insights (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  week_start date not null,
  created_at timestamptz not null default now()
);

alter table weekly_insights enable row level security;

create policy "Authenticated staff can read weekly insights"
  on weekly_insights for select
  to authenticated
  using (true);

create policy "Authenticated staff can insert weekly insights"
  on weekly_insights for insert
  to authenticated
  with check (true);
