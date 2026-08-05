-- Fix: vehicle_evaluations was created with an overly permissive policy
-- (using (true)) that let anyone with the public anon key read every
-- evaluation report via the REST API. Restrict to logged-in staff only,
-- matching the same pattern used for customers/vehicles.

drop policy if exists "Allow all for now (vehicle_evaluations)" on vehicle_evaluations;

create policy "Staff access (vehicle_evaluations)" on vehicle_evaluations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
