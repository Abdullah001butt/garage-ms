import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createJobCard } from "@/app/jobs/actions";
import { Card, PageHeader, PrimaryButton, Field, labelClass, inputClass } from "@/components/ui";
import { getActiveWarrantiesForVehicles } from "@/lib/warranty";

type VehicleOption = {
  id: string;
  customer_id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  customers: { name: string } | null;
};

export default async function NewJobCardPage() {
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, customer_id, plate_number, make, model, customers(name)")
    .order("plate_number")
    .returns<VehicleOption[]>();

  const warrantyMap = await getActiveWarrantiesForVehicles((vehicles ?? []).map((v) => v.id));

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <Link href="/jobs" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to job cards
      </Link>
      <PageHeader title="New Job Card" />

      {vehicles?.length === 0 && (
        <p className="text-sm text-slate-500 mb-4">
          No vehicles on file yet.{" "}
          <Link href="/customers/new" className="text-indigo-600 hover:underline">
            Add a customer & vehicle first
          </Link>
          .
        </p>
      )}

      {warrantyMap.size > 0 && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800 mb-1">
            🛡 {warrantyMap.size} vehicle{warrantyMap.size > 1 ? "s" : ""} under active warranty
          </p>
          <p className="text-xs text-emerald-700">
            Marked with ⚠ in the dropdown below — check before charging again for the same issue.
          </p>
        </Card>
      )}

      <Card className="p-5">
        <form action={createJobCard} className="space-y-4">
          <label className="block">
            <span className={labelClass}>
              Vehicle <span className="text-red-500">*</span>
            </span>
            <select name="vehicle_customer" required className={inputClass}>
              <option value="">Select a vehicle...</option>
              {vehicles?.map((v) => {
                const hasWarranty = (warrantyMap.get(v.id)?.length ?? 0) > 0;
                return (
                  <option key={v.id} value={`${v.id}::${v.customer_id}`}>
                    {hasWarranty ? "⚠ " : ""}
                    {v.plate_number} — {[v.make, v.model].filter(Boolean).join(" ")} (
                    {v.customers?.name})
                    {hasWarranty ? " — active warranty" : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>
              Description <span className="text-red-500">*</span>
            </span>
            <textarea
              name="description"
              required
              rows={3}
              placeholder="e.g. Oil change, brake pad replacement"
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Mechanic" name="mechanic_name" />
            <Field label="Odometer" name="odometer" type="number" />
          </div>

          <PrimaryButton type="submit">Create Job Card</PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
