-- Al Bahir Garage — Phase 32: company → employee hierarchy and "who pays" per car
-- An employee is an individual customer linked to a company customer.
alter table customers add column if not exists parent_customer_id uuid references customers(id) on delete set null;
alter table customers add column if not exists job_title text;
create index if not exists customers_parent_idx on customers(parent_customer_id);

-- Default payer for an employee's car: true = the company pays, false = the employee pays.
alter table vehicles add column if not exists company_pays boolean not null default false;

-- When a company pays for an employee's car, the job is billed to the company; remember who brought it.
-- (No foreign key on purpose: a second job_cards→customers link would make existing joins ambiguous.)
alter table job_cards add column if not exists driver_customer_id uuid;
alter table job_cards add column if not exists driver_name text;
