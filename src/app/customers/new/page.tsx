import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createCustomerWithVehicle } from "@/app/customers/actions";
import { Card, PageHeader, PrimaryButton, Field, labelClass, inputClass } from "@/components/ui";
import { EMIRATES, PLATE_PATTERN } from "@/lib/plate";

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const [{ data: customers }, { data: vehicles }] = await Promise.all([
    supabase.from("customers").select("name"),
    supabase.from("vehicles").select("make, model"),
  ]);

  const uniqueNames = [...new Set((customers ?? []).map((c) => c.name))];
  const uniqueMakes = [...new Set((vehicles ?? []).map((v) => v.make).filter(Boolean))];
  const uniqueModels = [...new Set((vehicles ?? []).map((v) => v.model).filter(Boolean))];

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <Link href="/customers" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to customers
      </Link>
      <PageHeader title="Add Customer" />

      <datalist id="customer-names">
        {uniqueNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="vehicle-makes">
        {uniqueMakes.map((m) => (
          <option key={m} value={m as string} />
        ))}
      </datalist>
      <datalist id="vehicle-models">
        {uniqueModels.map((m) => (
          <option key={m} value={m as string} />
        ))}
      </datalist>

      <form action={createCustomerWithVehicle} className="space-y-6">
        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Customer details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full name" name="name" required list="customer-names" />
            <Field label="Phone" name="phone" required />
            <Field label="Email" name="email" type="email" />
            <Field label="Address" name="address" />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Vehicle (optional — can add later)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Plate number"
              name="plate_number"
              placeholder="A 12345"
              pattern={PLATE_PATTERN}
              title='UAE plate format, e.g. "A 12345" or "12 4567"'
            />
            <label className="block">
              <span className={labelClass}>Emirate</span>
              <select name="emirate" defaultValue="Ajman" className={inputClass}>
                {EMIRATES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Make" name="make" placeholder="Toyota" list="vehicle-makes" />
            <Field label="Model" name="model" placeholder="Corolla" list="vehicle-models" />
            <Field label="Year" name="year" type="number" />
            <Field label="Color" name="color" />
          </div>
        </Card>

        <PrimaryButton type="submit">Save Customer</PrimaryButton>
      </form>
    </div>
  );
}
