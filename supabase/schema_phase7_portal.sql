-- Al Bahir Garage — Phase 7: Public customer portal lookup
-- Run this in the Supabase SQL editor after schema_phase6_auth_recurring_vat.sql

-- Security-definer function so an unauthenticated customer can look up
-- their own vehicle by phone + plate, without granting broad table access
-- to the anon role. Only returns data when both phone and plate match.
create or replace function portal_lookup(p_phone text, p_plate text)
returns jsonb as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'customer_name', c.name,
    'vehicle', jsonb_build_object(
      'plate_number', v.plate_number,
      'make', v.make,
      'model', v.model,
      'year', v.year
    ),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', j.description,
        'status', j.status,
        'mechanic_name', j.mechanic_name,
        'created_at', j.created_at,
        'completed_at', j.completed_at
      ) order by j.created_at desc)
      from job_cards j where j.vehicle_id = v.id
    ), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scheduled_at', a.scheduled_at,
        'status', a.status,
        'notes', a.notes
      ) order by a.scheduled_at desc)
      from appointments a where a.vehicle_id = v.id
    ), '[]'::jsonb)
  ) into result
  from vehicles v
  join customers c on c.id = v.customer_id
  where v.plate_number ilike p_plate
    and regexp_replace(c.phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
  limit 1;

  return result;
end;
$$ language plpgsql security definer stable;

grant execute on function portal_lookup(text, text) to anon;
