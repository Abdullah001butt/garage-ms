-- Al Bahir Garage — Phase 11: Audit log

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on audit_log(created_at desc);
create index if not exists audit_log_entity_idx on audit_log(entity_type, entity_id);

alter table audit_log enable row level security;

create policy "Owner reads audit log" on audit_log for select
  using (is_owner());

create policy "Any staff can write audit log" on audit_log for insert
  with check (auth.role() = 'authenticated');
