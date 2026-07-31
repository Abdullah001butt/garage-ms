-- Customers: distinguish Company vs Individual, add UAE business fields
alter table customers add column if not exists customer_type text not null default 'individual'
  check (customer_type in ('individual', 'company'));
alter table customers add column if not exists trn_number text;
alter table customers add column if not exists city text;
alter table customers add column if not exists landline text;
alter table customers add column if not exists representative text;
alter table customers add column if not exists reference_name text;

-- Vehicles: extended registration/spec details
alter table vehicles add column if not exists registration_expiry_date date;
alter table vehicles add column if not exists origin_trim text;
alter table vehicles add column if not exists body_type text;
alter table vehicles add column if not exists cylinders integer;
alter table vehicles add column if not exists current_mileage numeric(10, 1);
alter table vehicles add column if not exists odometer_reading numeric(10, 1);
