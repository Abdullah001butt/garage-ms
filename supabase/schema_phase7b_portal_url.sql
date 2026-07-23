-- Al Bahir Garage — Phase 7b: shop settings portal URL
alter table shop_settings add column if not exists portal_url text;
