import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Vehicle } from "@/lib/types";
import { addVehicle } from "@/app/customers/actions";
import { Card, PageHeader, EmptyState, Field } from "@/components/ui";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: vehicles }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single<Customer>(),
    supabase
      .from("vehicles")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .returns<Vehicle[]>(),
  ]);

  if (!customer) {
    notFound();
  }

  const addVehicleWithId = addVehicle.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href="/customers" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to customers
      </Link>

      <PageHeader
        title={customer.name}
        description={[customer.phone, customer.email, customer.address].filter(Boolean).join(" · ")}
      />

      <h2 className="text-sm font-semibold text-slate-700 mb-3">Vehicles</h2>
      <Card className="mb-6 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {vehicles?.map((vehicle) => (
            <li key={vehicle.id} className="px-4 py-3">
              <p className="font-medium text-slate-900">
                {vehicle.plate_number}
                {vehicle.make || vehicle.model
                  ? ` — ${[vehicle.make, vehicle.model].filter(Boolean).join(" ")}`
                  : ""}
              </p>
              <p className="text-sm text-slate-500">
                {[vehicle.year, vehicle.color].filter(Boolean).join(" · ") || "—"}
              </p>
            </li>
          ))}
        </ul>
        {vehicles?.length === 0 && <EmptyState message="No vehicles on file yet." />}
      </Card>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            + Add a vehicle
          </summary>
          <form action={addVehicleWithId} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field label="Plate number" name="plate_number" required />
            <Field label="Make" name="make" placeholder="Toyota" />
            <Field label="Model" name="model" placeholder="Corolla" />
            <Field label="Year" name="year" type="number" />
            <Field label="Color" name="color" />
            <Field label="VIN" name="vin" />
            <div className="col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
              >
                Add Vehicle
              </button>
            </div>
          </form>
        </details>
      </Card>
    </div>
  );
}
