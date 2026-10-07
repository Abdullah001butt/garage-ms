-- Al Bahir Garage — Phase 31: choose the printed invoice design (Classic or Modern)
alter table shop_settings add column if not exists invoice_style text not null default 'classic';
alter table shop_settings drop constraint if exists shop_settings_invoice_style_check;
alter table shop_settings add constraint shop_settings_invoice_style_check check (invoice_style in ('classic', 'modern'));
