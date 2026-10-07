import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createJobCard } from "@/app/jobs/actions";
import { PageHeader, Field, Alert } from "@/components/ui";
import { Steps, Step } from "@/components/Steps";
import { VehiclePicker, type VehicleOptionData } from "@/components/VehiclePicker";
import { getActiveWarrantiesForVehicles } from "@/lib/warranty";
import { JobDescriptionField } from "@/components/JobDescriptionField";
import type { JobTemplate } from "@/lib/types";

type VehicleOption = {
  id: string;
  customer_id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  company_pays: boolean | null;
  customers: { name: string; parent_customer_id: string | null } | null;
};

export default async function NewJobCardPage() {
  const supabase = await createClient();
  const [{ data: vehicles }, { data: templates }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, customer_id, plate_number, make, model, company_pays, customers(name, parent_customer_id)")
      .order("plate_number")
      .returns<VehicleOption[]>(),
    supabase.from("job_templates").select("*").order("created_at").returns<JobTemplate[]>(),
  ]);

  const warrantyMap = await getActiveWarrantiesForVehicles((vehicles ?? []).map((v) => v.id));
  const companyIds = [...new Set((vehicles ?? []).map((v) => v.customers?.parent_customer_id).filter(Boolean))] as string[];
  const { data: companies } = companyIds.length
    ? await supabase.from("customers").select("id, name").in("id", companyIds).returns<{ id: string; name: string }[]>()
    : { data: [] as { id: string; name: string }[] };
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));
  const vehicleOptions: VehicleOptionData[] = (vehicles ?? []).map((v) => ({
    id: v.id,
    customerId: v.customer_id,
    label: `${v.plate_number} — ${[v.make, v.model].filter(Boolean).join(" ")}`,
    ownerName: v.customers?.name ?? "",
    hasWarranty: (warrantyMap.get(v.id)?.length ?? 0) > 0,
    company: v.customers?.parent_customer_id ? companyById.get(v.customers.parent_customer_id) ?? null : null,
    companyPays: Boolean(v.company_pays),
  }));

  return (
    <div className="page">
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
          <VehiclePicker vehicles={vehicleOptions} />
          <p className="mt-1.5 text-xs text-zinc-500">
            New car or customer?{" "}
            <Link href="/customers/new" className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900">
              Add them first
            </Link>
            .
          </p>
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
