alter table vehicles add column if not exists share_token uuid unique default gen_random_uuid();

-- Backfill any existing rows that predate the default.
update vehicles set share_token = gen_random_uuid() where share_token is null;

-- Security-definer function so anyone holding the unguessable share_token
-- (from the vehicle's public certificate link) can view its verified
-- service history, without granting broad table access to the anon role.
create or replace function vehicle_certificate(p_token uuid)
returns jsonb as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'plate_number', v.plate_number,
    'emirate', v.emirate,
    'make', v.make,
    'model', v.model,
    'year', v.year,
    'color', v.color,
    'vin', v.vin,
    'body_type', v.body_type,
    'owner_name', c.name,
    'customer_since', c.created_at,
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', j.description,
        'status', j.status,
        'odometer', j.odometer,
        'created_at', j.created_at,
        'completed_at', j.completed_at
      ) order by j.created_at desc)
      from job_cards j where j.vehicle_id = v.id and j.status = 'completed'
    ), '[]'::jsonb)
  ) into result
  from vehicles v
  join customers c on c.id = v.customer_id
  where v.share_token = p_token
  limit 1;

  return result;
end;
$$ language plpgsql security definer stable;

grant execute on function vehicle_certificate(uuid) to anon;
