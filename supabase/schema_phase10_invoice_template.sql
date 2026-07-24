-- Al Bahir Garage — Phase 10: Custom invoice PDF template fields

alter table shop_settings add column if not exists email text;
alter table shop_settings add column if not exists website text;
alter table shop_settings add column if not exists facsimile text;
alter table shop_settings add column if not exists payment_method_note text default 'Cash Only';
alter table shop_settings add column if not exists payment_instructions text
  default 'PAYMENT SHOULD BE MADE BY CASH TO THE GARAGE';
alter table shop_settings add column if not exists invoice_disclaimer text
  default 'No Guarantee for spare parts, vehicle electric work or electric failure, battery re-charging & Lathe work';

alter table invoices add column if not exists discount numeric not null default 0;
