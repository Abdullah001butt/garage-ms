-- Al Bahir Garage — Phase 9: Warranty tracking
-- Run this in the Supabase SQL editor after schema_phase7b_portal_url.sql (and phase 8 if applied)

alter table invoice_items add column if not exists warranty_days int;
