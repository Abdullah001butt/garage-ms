-- Al Bahir Garage — Phase 36: third printed invoice design ("Showroom")
alter table shop_settings drop constraint if exists shop_settings_invoice_style_check;
alter table shop_settings add constraint shop_settings_invoice_style_check check (invoice_style in ('classic', 'modern', 'showroom'));
