import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateJobStatus } from "@/app/jobs/actions";
import { createInvoiceFromJobCard } from "@/app/invoices/actions";
import type { JobStatus } from "@/lib/types";
import { Card, PageHeader, Badge, PrimaryButton, SecondaryButton } from "@/components/ui";

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

  const [{ data: job }, { data: existingInvoice }] = await Promise.all([
    supabase
      .from("job_cards")
      .select(
        "id, description, mechanic_name, odometer, status, created_at, completed_at, customer_id, vehicle_id, vehicles(plate_number, make, model, year), customers(name, phone)"
      )
      .eq("id", id)
      .single<JobDetail>(),
    supabase.from("invoices").select("id").eq("job_card_id", id).maybeSingle(),
  ]);

  if (!job) {
    notFound();
  }

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

      <div className="flex flex-wrap gap-2 mb-6">
        {(["pending", "in_progress", "completed"] as JobStatus[]).map((s) => (
          <form key={s} action={updateJobStatus.bind(null, job.id, s)}>
            <SecondaryButton type="submit" disabled={job.status === s}>
              Mark {STATUS_LABEL[s]}
            </SecondaryButton>
          </form>
        ))}
      </div>

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
