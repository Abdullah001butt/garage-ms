-- Al Bahir Garage — Phase 13: Public self-service appointment booking

alter table appointments add column if not exists booked_online boolean not null default false;

-- Security-definer RPC so an unauthenticated visitor can request an appointment
-- without granting broad table access to the anon role. Finds or creates the
-- customer/vehicle by phone, then inserts a scheduled appointment.
create or replace function public_book_appointment(
  p_name text,
  p_phone text,
  p_plate text,
  p_make text,
  p_model text,
  p_scheduled_at timestamptz,
  p_notes text
) returns uuid as $$
declare
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_appointment_id uuid;
begin
  select id into v_customer_id
  from customers
  where regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
  limit 1;

  if v_customer_id is null then
    insert into customers (name, phone)
    values (p_name, p_phone)
    returning id into v_customer_id;
  end if;

  if p_plate is not null and length(trim(p_plate)) > 0 then
    select id into v_vehicle_id
    from vehicles
    where customer_id = v_customer_id and plate_number ilike p_plate
    limit 1;

    if v_vehicle_id is null then
      insert into vehicles (customer_id, plate_number, make, model)
      values (v_customer_id, p_plate, nullif(p_make, ''), nullif(p_model, ''))
      returning id into v_vehicle_id;
    end if;
  end if;

  insert into appointments (customer_id, vehicle_id, scheduled_at, notes, status, booked_online)
  values (v_customer_id, v_vehicle_id, p_scheduled_at, p_notes, 'scheduled', true)
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$ language plpgsql security definer;

grant execute on function public_book_appointment(text, text, text, text, text, timestamptz, text) to anon;
