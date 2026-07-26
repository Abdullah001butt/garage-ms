import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Vehicle } from "@/lib/types";
import {
  addVehicle,
  updateVehicleServiceInterval,
  updateCustomer,
  deleteCustomer,
  updateVehicle,
  deleteVehicle,
} from "@/app/customers/actions";
import { Card, PageHeader, EmptyState, Field, Badge, SecondaryButton } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { getActiveWarrantiesForVehicles } from "@/lib/warranty";

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

  const warrantyMap = await getActiveWarrantiesForVehicles((vehicles ?? []).map((v) => v.id));

  const addVehicleWithId = addVehicle.bind(null, id);
  const updateCustomerWithId = updateCustomer.bind(null, id);
  const deleteCustomerWithId = deleteCustomer.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href="/customers" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to customers
      </Link>

      <PageHeader
        title={customer.name}
        description={[customer.phone, customer.email, customer.address].filter(Boolean).join(" · ")}
      />

      <Card className="mb-6 p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Edit customer details
          </summary>
          <form action={updateCustomerWithId} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Field label="Name" name="name" defaultValue={customer.name} required />
            <Field label="Phone" name="phone" defaultValue={customer.phone} required />
            <Field label="Email" name="email" defaultValue={customer.email ?? ""} />
            <Field label="Address" name="address" defaultValue={customer.address ?? ""} />
            <div className="col-span-2">
              <SecondaryButton type="submit">Save Changes</SecondaryButton>
            </div>
          </form>
          <div className="mt-3">
            <ConfirmSubmitButton
              action={deleteCustomerWithId}
              confirmMessage={`Delete customer "${customer.name}" and all their records? This cannot be undone.`}
              successMessage="Customer deleted."
              redirectTo="/customers"
            >
              Delete Customer
            </ConfirmSubmitButton>
          </div>
        </details>
      </Card>

      <h2 className="text-sm font-semibold text-slate-700 mb-3">Vehicles</h2>
      <Card className="mb-6 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {vehicles?.map((vehicle) => {
            const warranties = warrantyMap.get(vehicle.id) ?? [];
            return (
              <li key={vehicle.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {vehicle.plate_number}
                    {vehicle.make || vehicle.model
                      ? ` — ${[vehicle.make, vehicle.model].filter(Boolean).join(" ")}`
                      : ""}
                  </p>
                  <p className="text-sm text-slate-500">
                    {[vehicle.year, vehicle.color].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {warranties.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">
                      🛡 {warranties.map((w) => w.description).join(", ")} — until{" "}
                      {warranties[0].until.toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <Link
                      href={`/vehicles/${vehicle.id}/qr`}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      View QR Code &rarr;
                    </Link>
                    <form
                      action={updateVehicleServiceInterval.bind(null, id, vehicle.id)}
                      className="flex items-center gap-1"
                    >
                      <span className="text-xs text-slate-400">Service every</span>
                      <input
                        type="number"
                        name="service_interval_days"
                        defaultValue={vehicle.service_interval_days ?? ""}
                        placeholder="90"
                        className="w-14 rounded border border-slate-300 px-1 py-0.5 text-xs"
                      />
                      <span className="text-xs text-slate-400">days</span>
                      <button type="submit" className="text-xs text-indigo-600 hover:underline">
                        Save
                      </button>
                    </form>
                    <details className="inline-block">
                      <summary className="cursor-pointer text-xs text-slate-500 hover:underline">
                        Edit vehicle
                      </summary>
                      <form
                        action={updateVehicle.bind(null, id, vehicle.id)}
                        className="mt-2 grid grid-cols-2 gap-2 w-64"
                      >
                        <Field label="Plate" name="plate_number" defaultValue={vehicle.plate_number} required className="col-span-2" />
                        <Field label="Make" name="make" defaultValue={vehicle.make ?? ""} />
                        <Field label="Model" name="model" defaultValue={vehicle.model ?? ""} />
                        <Field label="Year" name="year" type="number" defaultValue={vehicle.year ?? ""} />
                        <Field label="Color" name="color" defaultValue={vehicle.color ?? ""} />
                        <Field label="VIN" name="vin" defaultValue={vehicle.vin ?? ""} className="col-span-2" />
                        <button
                          type="submit"
                          className="col-span-2 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                        >
                          Save Vehicle
                        </button>
                      </form>
                    </details>
                    <ConfirmSubmitButton
                      action={deleteVehicle.bind(null, id, vehicle.id)}
                      confirmMessage={`Delete vehicle "${vehicle.plate_number}"? This cannot be undone.`}
                      successMessage="Vehicle deleted."
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </div>
                </div>
                {warranties.length > 0 && <Badge color="green">Under Warranty</Badge>}
              </li>
            );
          })}
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
