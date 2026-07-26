import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateJobStatus, updateJobCard, deleteJobCard } from "@/app/jobs/actions";
import { createInvoiceFromJobCard } from "@/app/invoices/actions";
import type { JobStatus } from "@/lib/types";
import { Card, PageHeader, Badge, PrimaryButton, SecondaryButton, Field } from "@/components/ui";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

type JobDetail = {
  id: string;
  description: string;
  mechanic_name: string | null;
  odometer: number | null;
  status: JobStatus;
  created_at: string;
  completed_at: string | null;
  customer_id: string;
  vehicle_id: string;
  vehicles: {
    plate_number: string;
    make: string | null;
    model: string | null;
    year: number | null;
  } | null;
  customers: { name: string; phone: string } | null;
};

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_COLOR: Record<JobStatus, "gray" | "amber" | "green"> = {
  pending: "gray",
  in_progress: "amber",
  completed: "green",
};

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: job }, { data: existingInvoice }, { data: settings }] = await Promise.all([
    supabase
      .from("job_cards")
      .select(
        "id, description, mechanic_name, odometer, status, created_at, completed_at, customer_id, vehicle_id, vehicles(plate_number, make, model, year), customers(name, phone)"
      )
      .eq("id", id)
      .single<JobDetail>(),
    supabase.from("invoices").select("id").eq("job_card_id", id).maybeSingle(),
    supabase.from("shop_settings").select("google_review_link").maybeSingle(),
  ]);

  if (!job) {
    notFound();
  }

  const vehicleLabel = [job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ") || "vehicle";
  const customerFirstName = job.customers?.name?.split(" ")[0] ?? "there";
  const message =
    job.status === "completed"
      ? `Hi ${customerFirstName}, your ${vehicleLabel} (${job.vehicles?.plate_number}) is ready for pickup at Al Bahir Garage. Please let us know when you'd like to collect it.`
      : job.status === "in_progress"
      ? `Hi ${customerFirstName}, your ${vehicleLabel} (${job.vehicles?.plate_number}) is currently being serviced at Al Bahir Garage. We'll notify you once it's ready.`
      : `Hi ${customerFirstName}, we've received your ${vehicleLabel} (${job.vehicles?.plate_number}) at Al Bahir Garage for: ${job.description}.`;

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <Link href="/jobs" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to job cards
      </Link>

      <PageHeader
        title={`${job.vehicles?.plate_number} — ${[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ")}`}
        description={`${job.customers?.name} · ${job.customers?.phone}`}
        action={<Badge color={STATUS_COLOR[job.status]}>{STATUS_LABEL[job.status]}</Badge>}
      />

      <Card className="p-5 mb-6 space-y-2">
        <p>
          <span className="font-medium">Description:</span> {job.description}
        </p>
        {job.mechanic_name && (
          <p>
            <span className="font-medium">Mechanic:</span> {job.mechanic_name}
          </p>
        )}
        {job.odometer && (
          <p>
            <span className="font-medium">Odometer:</span> {job.odometer}
          </p>
        )}
        <p className="text-sm text-slate-500">
          Created {new Date(job.created_at).toLocaleString()}
        </p>
        {job.completed_at && (
          <p className="text-sm text-slate-500">
            Completed {new Date(job.completed_at).toLocaleString()}
          </p>
        )}
      </Card>

      <Card className="p-4 mb-6">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Edit job card
          </summary>
          <form action={updateJobCard.bind(null, job.id)} className="space-y-4 mt-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
              <textarea
                name="description"
                required
                rows={3}
                defaultValue={job.description}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Mechanic" name="mechanic_name" defaultValue={job.mechanic_name ?? ""} />
              <Field label="Odometer" name="odometer" type="number" defaultValue={job.odometer ?? ""} />
            </div>
            <SecondaryButton type="submit">Save Changes</SecondaryButton>
          </form>
          <form action={deleteJobCard.bind(null, job.id)} className="mt-3">
            <ConfirmSubmitButton confirmMessage="Delete this job card? This cannot be undone.">
              Delete Job Card
            </ConfirmSubmitButton>
          </form>
        </details>
      </Card>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["pending", "in_progress", "completed"] as JobStatus[]).map((s) => (
          <form key={s} action={updateJobStatus.bind(null, job.id, s)}>
            <SecondaryButton type="submit" disabled={job.status === s}>
              Mark {STATUS_LABEL[s]}
            </SecondaryButton>
          </form>
        ))}
      </div>

      {job.customers?.phone && (
        <div className="flex flex-wrap gap-2 mb-6">
          <WhatsAppButton phone={job.customers.phone} message={message} />
          {job.status === "completed" && settings?.google_review_link && (
            <WhatsAppButton
              phone={job.customers.phone}
              label="Request Review"
              message={`Hi ${customerFirstName}, thank you for choosing Al Bahir Garage! If you were happy with our service, we'd really appreciate a quick Google review: ${settings.google_review_link}`}
            />
          )}
        </div>
      )}

      {existingInvoice ? (
        <Link href={`/invoices/${existingInvoice.id}`}>
          <SecondaryButton type="button">View Invoice &rarr;</SecondaryButton>
        </Link>
      ) : (
        <form action={createInvoiceFromJobCard.bind(null, job.id, job.customer_id)}>
          <PrimaryButton type="submit">Create Invoice</PrimaryButton>
        </form>
      )}
    </div>
  );
}
