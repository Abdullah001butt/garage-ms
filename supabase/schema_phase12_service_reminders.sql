-- Al Bahir Garage — Phase 12: Service due reminders

alter table shop_settings add column if not exists default_service_interval_days int not null default 90;
alter table vehicles add column if not exists service_interval_days int;
