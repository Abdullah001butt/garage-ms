alter table parts
  add column if not exists supplier_name text,
  add column if not exists supplier_phone text;
