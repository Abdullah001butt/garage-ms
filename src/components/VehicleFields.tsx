import { Field, labelClass, inputClass } from "@/components/ui";
import { EMIRATES } from "@/lib/plate";
import type { Vehicle } from "@/lib/types";

const BODY_TYPES = ["Sedan", "SUV", "Hatchback", "Pickup", "Van", "Coupe", "Bus", "Truck", "Other"];

export function VehicleFields({
  vehicle,
  makeListId,
  modelListId,
  required = false,
}: {
  vehicle?: Vehicle;
  makeListId?: string;
  modelListId?: string;
  required?: boolean;
}) {
  return (
    <>
      <Field
        label="Plate number"
        name="plate_number"
        placeholder="A 12345"
        defaultValue={vehicle?.plate_number}
        required={required}
        title='UAE plate format, e.g. "A 12345" or "12 4567"'
      />
      <label className="block">
        <span className={labelClass}>Emirate</span>
        <select name="emirate" defaultValue={vehicle?.emirate ?? "Ajman"} className={inputClass}>
          {EMIRATES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="Registration Expiry (Mulkiya)"
        name="registration_expiry_date"
        type="date"
        defaultValue={vehicle?.registration_expiry_date ?? ""}
      />
      <Field label="Make" name="make" placeholder="Toyota" defaultValue={vehicle?.make ?? ""} list={makeListId} />
      <Field label="Model" name="model" placeholder="Corolla" defaultValue={vehicle?.model ?? ""} list={modelListId} />
      <Field label="Year" name="year" type="number" defaultValue={vehicle?.year ?? ""} />
      <Field label="Origin / Trim" name="origin_trim" placeholder="GCC, Sport, etc." defaultValue={vehicle?.origin_trim ?? ""} />
      <Field label="Chassis Number (VIN)" name="vin" defaultValue={vehicle?.vin ?? ""} />
      <label className="block">
        <span className={labelClass}>Body Type</span>
        <select name="body_type" defaultValue={vehicle?.body_type ?? ""} className={inputClass}>
          <option value="">Select body type...</option>
          {BODY_TYPES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <Field label="Color" name="color" defaultValue={vehicle?.color ?? ""} />
      <Field label="No. of Cylinders" name="cylinders" type="number" defaultValue={vehicle?.cylinders ?? ""} />
      <Field label="Current Mileage (KM)" name="current_mileage" type="number" step="0.1" defaultValue={vehicle?.current_mileage ?? ""} />
      <Field label="Odometer Reading" name="odometer_reading" type="number" step="0.1" defaultValue={vehicle?.odometer_reading ?? ""} />
    </>
  );
}
