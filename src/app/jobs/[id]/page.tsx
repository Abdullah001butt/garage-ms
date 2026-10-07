import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateJobStatus, updateJobCard, deleteJobCard, addJobSublet, deleteJobSublet } from "@/app/jobs/actions";
import { createInvoiceFromJobCard } from "@/app/invoices/actions";
import type { AuditLog, JobStatus, JobSublet } from "@/lib/types";
import { Card, Badge, Panel, PanelEmpty, PrimaryButton, SecondaryButton, Field, inputClass, labelClass } from "@/components/ui";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { RowMenu, RowMenuAction, RowMenuDelete, RowMenuOpenPanel, RowMenuSeparator } from "@/components/RowMenu";
import { SlideOver } from "@/components/SlideOver";
import { ActivityTimeline, auditVisual, type ActivityEvent } from "@/components/ActivityTimeline";
import { Icon } from "@/components/icons";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { auditLabel } from "@/lib/audit-labels";
import { PlateBadge } from "@/components/PlateBadge";

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
    emirate: string;
    make: string | null;
    model: string | null;
    year: number | null;
  } | null;
  customers: { name: string; phone: string } | null;
};

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_COLOR: Record<JobStatus, "slate" | "amber" | "green"> = {
  pending: "slate",
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

  const [{ data: job }, { data: existingInvoice }, { data: settings }, { data: sublets }] = await Promise.all([
    supabase
      .from("job_cards")
      .select(
        "id, description, mechanic_name, odometer, status, created_at, completed_at, customer_id, vehicle_id, vehicles(plate_number, emirate, make, model, year), customers(name, phone)"
      )
      .eq("id", id)
      .single<JobDetail>(),
    supabase.from("invoices").select("id, created_at, invoice_number, payments(id, amount, paid_at, method)").eq("job_card_id", id).maybeSingle(),
    supabase.from("shop_settings").select("google_review_link").maybeSingle(),
    supabase
      .from("job_sublets")
      .select("*")
      .eq("job_card_id", id)
      .order("created_at", { ascending: false })
      .returns<JobSublet[]>(),
  ]);

  if (!job) {
    notFound();
  }

  const subletTotal = (sublets ?? []).reduce((s, sub) => s + Number(sub.cost), 0);
  const vehicleLabel = [job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ") || "vehicle";
  const customerFirstName = job.customers?.name?.split(" ")[0] ?? "there";
  const message =
    job.status === "completed"
      ? `Hi ${customerFirstName}, your ${vehicleLabel} (${job.vehicles?.plate_number}) is ready for pickup at Al Bahir Garage. Please let us know when you'd like to collect it.`
      : job.status === "in_progress"
      ? `Hi ${customerFirstName}, your ${vehicleLabel} (${job.vehicles?.plate_number}) is currently being serviced at Al Bahir Garage. We'll notify you once it's ready.`
      : `Hi ${customerFirstName}, we've received your ${vehicleLabel} (${job.vehicles?.plate_number}) at Al Bahir Garage for: ${job.description}.`;

  const invoice = existingInvoice as
    | { id: string; created_at: string; invoice_number: number | null; payments: { id: string; amount: number; paid_at: string; method: string }[] }
    | null;

  const { data: logs } = await supabase
    .from("audit_log")
    .select("*")
    .in("entity_id", [id, ...(invoice ? [invoice.id] : [])])
    .order("created_at", { ascending: false })
    .limit(40)
    .returns<AuditLog[]>();

  const activity: ActivityEvent[] = [
    { id: "opened", at: job.created_at, title: "Job card opened", detail: job.description, icon: "wrench", tone: "blue" },
    ...(job.completed_at ? [{ id: "done", at: job.completed_at, title: "Work completed", icon: "check-circle" as const, tone: "green" as const }] : []),
    ...(sublets ?? []).map((s): ActivityEvent => ({
      id: `s-${s.id}`,
      at: s.created_at,
      title: `Outsourced to ${s.vendor_name}`,
      detail: `${s.description} · AED ${Number(s.cost).toFixed(2)}`,
      icon: "package",
      tone: "slate",
    })),
    ...(invoice
      ? [
          {
            id: `inv-${invoice.id}`,
            at: invoice.created_at,
            title: `Invoice ${formatInvoiceNumber(invoice.invoice_number, invoice.created_at) ?? ""} issued`,
            icon: "receipt" as const,
            tone: "blue" as const,
          },
          ...invoice.payments.map((p): ActivityEvent => ({
            id: `p-${p.id}`,
            at: p.paid_at,
            title: `Payment received · AED ${Number(p.amount).toFixed(2)}`,
            detail: methodLabel(p.method),
            icon: "wallet",
            tone: "green",
          })),
        ]
      : []),
    ...(logs ?? [])
      .filter((l) => !["invoice.create", "payment.record", "job.sublet_add"].includes(l.action))
      .map((l): ActivityEvent => {
        const newStatus = (l.details as { new_status?: string } | null)?.new_status;
        return {
          id: `a-${l.id}`,
          at: l.created_at,
          title: newStatus ? `Status → ${STATUS_LABEL[newStatus as JobStatus] ?? newStatus}` : auditLabel(l.action),
          actor: l.actor_name,
          ...auditVisual(l.action),
        };
      }),
  ];

  const steps = [
    { key: "pending", label: "Received", done: true },
    { key: "in_progress", label: "In progress", done: job.status !== "pending" },
    { key: "completed", label: "Completed", done: job.status === "completed" },
    { key: "invoiced", label: "Invoiced", done: !!invoice },
  ];
  // The first step not yet reached is "current"; when everything is done, all steps show a tick.
  const currentStep = steps.findIndex((s) => !s.done);
  const nextStatus: JobStatus | null = job.status === "pending" ? "in_progress" : job.status === "in_progress" ? "completed" : null;

  return (
    <div className="page">
      <Link href="/jobs" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to job cards
      </Link>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          {job.vehicles && <PlateBadge plateNumber={job.vehicles.plate_number} emirate={job.vehicles.emirate} size="lg" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-[22px]">
                {[job.vehicles?.make, job.vehicles?.model, job.vehicles?.year].filter(Boolean).join(" ") || "Job card"}
              </h1>
              <Badge color={STATUS_COLOR[job.status]} dot>
                {STATUS_LABEL[job.status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              <Link href={`/customers/${job.customer_id}`} className="font-medium text-zinc-700 hover:underline">
                {job.customers?.name}
              </Link>
              {job.customers?.phone ? ` · ${job.customers.phone}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {job.customers?.phone && <WhatsAppButton phone={job.customers.phone} message={message} label="Notify" />}
          {job.status === "completed" && job.customers?.phone && settings?.google_review_link && (
            <WhatsAppButton
              phone={job.customers.phone}
              label="Request review"
              message={`Hi ${customerFirstName}, thank you for choosing Al Bahir Garage! If you were happy with our service, we'd really appreciate a quick Google review: ${settings.google_review_link}`}
            />
          )}
          {nextStatus && (
            <form action={updateJobStatus.bind(null, job.id, nextStatus)}>
              <SecondaryButton type="submit" icon={nextStatus === "completed" ? "check" : "arrow-right"}>
                {nextStatus === "completed" ? "Mark as done" : "Start job"}
              </SecondaryButton>
            </form>
          )}
          {invoice ? (
            <Link href={`/invoices/${invoice.id}`}>
              <PrimaryButton type="button" icon="receipt">
                View invoice
              </PrimaryButton>
            </Link>
          ) : (
            <form action={createInvoiceFromJobCard.bind(null, job.id, job.customer_id)}>
              <PrimaryButton type="submit" icon="receipt">
                Create invoice
              </PrimaryButton>
            </form>
          )}
          <div className="rounded-md border border-zinc-300 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
            <RowMenu label="More actions">
              <RowMenuOpenPanel panelId="edit-job" icon="pencil">
                Edit job card
              </RowMenuOpenPanel>
              {(["pending", "in_progress", "completed"] as JobStatus[])
                .filter((s) => s !== job.status)
                .map((s) => (
                  <RowMenuAction key={s} action={updateJobStatus.bind(null, job.id, s)} icon="clock" successMessage={`Status set to ${STATUS_LABEL[s]}.`}>
                    Set status: {STATUS_LABEL[s]}
                  </RowMenuAction>
                ))}
              <RowMenuSeparator />
              <RowMenuDelete
                action={deleteJobCard.bind(null, job.id)}
                confirmMessage="Delete this job card? This can't be undone."
                successMessage="Job card deleted."
                label="Delete job card"
                redirectTo="/jobs"
              />
            </RowMenu>
          </div>
        </div>
      </div>

      <SlideOver id="edit-job" hideTrigger title="Edit job card" description="Work description, mechanic and odometer." triggerLabel="Edit">
        <form action={updateJobCard.bind(null, job.id)} className="space-y-4">
          <label className="block">
            <span className={labelClass}>Description</span>
            <textarea name="description" required rows={4} defaultValue={job.description} className={inputClass} />
          </label>
          <Field label="Mechanic" name="mechanic_name" defaultValue={job.mechanic_name ?? ""} />
          <Field label="Odometer (km)" name="odometer" type="number" defaultValue={job.odometer ?? ""} />
          <PrimaryButton type="submit" className="w-full">
            Save changes
          </PrimaryButton>
        </form>
      </SlideOver>

      <Card className="mb-6 px-5 py-4">
        <ol className="flex items-center">
          {steps.map((step, i) => (
            <li key={step.key} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
              <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    step.done
                      ? "bg-zinc-900 text-white"
                      : i === currentStep
                        ? "bg-brand-600 text-white ring-4 ring-brand-100"
                        : "border border-zinc-300 bg-white text-zinc-400"
                  }`}
                >
                  {step.done ? <Icon name="check" className="h-3 w-3" /> : i + 1}
                </span>
                <span className={`whitespace-nowrap text-[11px] font-medium sm:text-[13px] ${step.done || i === currentStep ? "text-zinc-900" : "text-zinc-400"}`}>{step.label}</span>
              </div>
              {i < steps.length - 1 && <span className={`mx-1.5 mb-5 h-px flex-1 sm:mx-3 sm:mb-0 ${steps[i + 1].done ? "bg-zinc-900" : "bg-zinc-200"}`} />}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="border-b border-zinc-200 px-5 py-4">
              <p className="text-xs font-medium text-zinc-500">Work requested</p>
              <p className="mt-1 text-sm text-zinc-900">{job.description}</p>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4">
              {[
                ["Mechanic", job.mechanic_name ?? "Unassigned"],
                ["Odometer", job.odometer ? `${Number(job.odometer).toLocaleString("en-US")} km` : "—"],
                ["Opened", formatDateTime(job.created_at)],
                ["Completed", job.completed_at ? formatDateTime(job.completed_at) : "—"],
              ].map(([label, value], i) => (
                <div key={label} className={`px-5 py-3 ${i > 0 ? "sm:border-l sm:border-zinc-200" : ""}`}>
                  <dt className="text-xs font-medium text-zinc-500">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-zinc-900 tabular">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Panel
            title="Outsourced work"
            count={(sublets ?? []).length}
            action={
              <div className="flex items-center gap-3">
                {subletTotal > 0 && <span className="font-medium text-zinc-900 tabular">AED {subletTotal.toFixed(2)}</span>}
                <SlideOver title="Add outsourced cost" description="Work sent to another workshop or specialist." triggerLabel="Add" variant="secondary">
                  <form action={addJobSublet.bind(null, job.id)} className="space-y-4">
                    <Field label="Vendor" name="vendor_name" placeholder="e.g. Al Ayaam Garage" required />
                    <Field label="Description" name="description" placeholder="e.g. Lathe work on crankshaft" required />
                    <Field label="Cost (AED)" name="cost" type="number" step="0.01" required />
                    <PrimaryButton type="submit" className="w-full">
                      Add cost
                    </PrimaryButton>
                  </form>
                </SlideOver>
              </div>
            }
          >
            {(sublets ?? []).length === 0 ? (
              <PanelEmpty message="No outsourced work recorded for this job." />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {(sublets ?? []).map((sub) => (
                  <li key={sub.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900">{sub.vendor_name}</p>
                      <p className="truncate text-xs text-zinc-500">{sub.description}</p>
                    </div>
                    <span className="shrink-0 font-medium text-zinc-900 tabular">AED {Number(sub.cost).toFixed(2)}</span>
                    <RowMenu>
                      <RowMenuDelete
                        action={deleteJobSublet.bind(null, job.id, sub.id)}
                        confirmMessage="Remove this outsourced cost?"
                        successMessage="Removed."
                        label="Remove"
                      />
                    </RowMenu>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Activity" className="lg:col-span-2" action={<span className="text-xs text-zinc-500">Newest first</span>}>
          <ActivityTimeline events={activity} />
        </Panel>
      </div>
    </div>
  );
}

function methodLabel(method: string) {
  const spaced = method.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
