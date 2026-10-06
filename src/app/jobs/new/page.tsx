import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createJobCard } from "@/app/jobs/actions";
import { Card, PageHeader, PrimaryButton, Field, labelClass, inputClass, Alert } from "@/components/ui";
import { getActiveWarrantiesForVehicles } from "@/lib/warranty";
import { JobDescriptionField } from "@/components/JobDescriptionField";
import type { JobTemplate } from "@/lib/types";

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
  const [{ data: vehicles }, { data: templates }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, customer_id, plate_number, make, model, customers(name)")
      .order("plate_number")
      .returns<VehicleOption[]>(),
    supabase.from("job_templates").select("*").order("created_at").returns<JobTemplate[]>(),
  ]);

  const warrantyMap = await getActiveWarrantiesForVehicles((vehicles ?? []).map((v) => v.id));

  return (
    <div className="page page-narrow">
      <Link href="/jobs" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to job cards
      </Link>
      <PageHeader title="New Job Card" />

      {vehicles?.length === 0 && (
        <p className="text-sm text-zinc-500 mb-4">
          No vehicles on file yet.{" "}
          <Link href="/customers/new" className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 hover:decoration-zinc-600">
            Add a customer & vehicle first
          </Link>
          .
        </p>
      )}

      {warrantyMap.size > 0 && (
        <Alert
          tone="success"
          icon="shield"
          className="mb-4"
          title={`${warrantyMap.size} vehicle${warrantyMap.size > 1 ? "s" : ""} under active warranty`}
        >
          Marked [Warranty] in the list below — check before charging again for the same issue.
        </Alert>
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
                    {hasWarranty ? "[Warranty] " : ""}
                    {v.plate_number} — {[v.make, v.model].filter(Boolean).join(" ")} (
                    {v.customers?.name})
                    {hasWarranty ? " — active warranty" : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <JobDescriptionField templates={templates ?? []} />

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
