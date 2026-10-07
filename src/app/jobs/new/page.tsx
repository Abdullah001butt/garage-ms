import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createJobCard } from "@/app/jobs/actions";
import { PageHeader, Field, labelClass, inputClass, Alert } from "@/components/ui";
import { Steps, Step } from "@/components/Steps";
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

      <Steps
        action={createJobCard}
        submitLabel="Create job card"
        review
        steps={[
          { id: "vehicle", title: "Vehicle", description: "Which car is in for service? It brings the customer with it." },
          { id: "work", title: "Work needed", description: "What the customer asked for. Pick a template to fill it in quickly." },
          { id: "assign", title: "Assign & save", description: "Who is working on it and the current odometer reading." },
        ]}
      >
        <Step id="vehicle">
          <label className="block">
            <span className={labelClass}>
              Vehicle <span className="text-brand-600">*</span>
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
            <span className="mt-1.5 block text-xs text-zinc-500">
              New car or customer?{" "}
              <Link href="/customers/new" className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900">
                Add them first
              </Link>
              .
            </span>
          </label>
        </Step>

        <Step id="work">
          <JobDescriptionField templates={templates ?? []} />
        </Step>

        <Step id="assign" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Mechanic" name="mechanic_name" />
          <Field label="Odometer" name="odometer" type="number" />
        </Step>
      </Steps>
    </div>
  );
}
