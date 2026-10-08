import { ctxAttr } from "@/lib/ctx";
import { SplitView } from "@/components/SplitView";
import { formatDate } from "@/lib/format";
import { PeekButton } from "@/components/Peek";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton, SegmentedLinks, theadClass, thClass } from "@/components/ui";
import { JobsBoard } from "@/components/JobsBoard";
import { PlateBadge } from "@/components/PlateBadge";
import { Morph } from "@/components/Morph";
import { updateJobStatus } from "@/app/jobs/actions";
import { updateJobInline } from "@/app/inline-actions";
import { InlineEdit } from "@/components/InlineEdit";

type JobRow = {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  mechanic_name: string | null;
  created_at: string;
  vehicles: { plate_number: string; emirate: string; make: string | null; model: string | null } | null;
  customer_id: string;
  customers: { name: string; phone: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_COLOR: Record<string, "slate" | "amber" | "green"> = {
  pending: "slate",
  in_progress: "amber",
  completed: "green",
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const { status, view } = await searchParams;
  const isBoard = view !== "list";
  const supabase = await createClient();

  let query = supabase
    .from("job_cards")
    .select(
      "id, description, status, mechanic_name, created_at, customer_id, vehicles(plate_number, emirate, make, model), customers(name, phone)"
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: jobs, error } = await query.returns<JobRow[]>();

  const [{ data: invoicedJobIds }, { data: staff }] = await Promise.all([
    supabase.from("invoices").select("job_card_id").not("job_card_id", "is", null),
    supabase.from("profiles").select("full_name").order("full_name"),
  ]);
  const staffNames = [...new Set((staff ?? []).map((p) => p.full_name).filter(Boolean))] as string[];
  const mechanicOptions = (current: string | null) => [
    { value: "", label: "Unassigned" },
    ...[...new Set([...(current ? [current] : []), ...staffNames])].map((n) => ({ value: n, label: n })),
  ];
  const statusOptions = ["pending", "in_progress", "completed"].map((s) => ({ value: s, label: STATUS_LABEL[s] }));
  const invoicedSet = new Set((invoicedJobIds ?? []).map((i) => i.job_card_id));

  const allJobs = jobs ?? [];
  const uninvoicedIds = allJobs.filter((j) => j.status === "completed" && !invoicedSet.has(j.id)).map((j) => j.id);
  const statusHref = (s: string) =>
    s ? `/jobs?status=${s}${view ? `&view=${view}` : ""}` : `/jobs${view ? `?view=${view}` : ""}`;

  return (
    <div className="page">
      <PageHeader
        title="Job Cards"
        description={isBoard ? "Every vehicle in for service. Drag a card to another column to change its stage." : "Every vehicle in for service, from check-in to invoice."}
        action={
          <Link href="/jobs/new">
            <PrimaryButton type="button">+ New Job Card</PrimaryButton>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SegmentedLinks
          items={["", "pending", "in_progress", "completed"].map((s) => ({
            label: s ? STATUS_LABEL[s] : "All",
            href: statusHref(s),
            active: (status ?? "") === s,
          }))}
        />
        <SegmentedLinks
          items={[
            { label: "Board", href: `/jobs${status ? `?status=${status}` : ""}`, active: isBoard },
            { label: "List", href: `/jobs?view=list${status ? `&status=${status}` : ""}`, active: !isBoard },
          ]}
        />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">Failed to load job cards: {error.message}</p>}

      {isBoard ? (
        allJobs.length === 0 ? (
          <Card>
            <EmptyState icon="wrench" title="No job cards yet" message="Open a job card when a car arrives — it tracks the work from check-in to invoice." action={<><Link href="/jobs/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-700">+ New job card</Link></>} />
          </Card>
        ) : (
          <JobsBoard jobs={allJobs} uninvoicedIds={uninvoicedIds} updateJobStatus={updateJobStatus} />
        )
      ) : (
        <SplitView type="job" storageKey="split:jobs" hrefBase="/jobs">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Vehicle</th>
                  <th className={`${thClass} hidden md:table-cell`}>Customer</th>
                  <th data-split-hide className={`${thClass} hidden lg:table-cell`}>Work</th>
                  <th className={`${thClass} hidden md:table-cell`}>Mechanic</th>
                  <th className={`${thClass} hidden sm:table-cell`}>Status</th>
                  <th className={`${thClass} hidden sm:table-cell text-right`}>Opened</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {allJobs.map((job) => (
                  <tr
                    key={job.id}
                    data-split-id={job.id}
                    {...ctxAttr({
                      t: "job",
                      id: job.id,
                      status: job.status,
                      plate: job.vehicles?.plate_number,
                      title: [job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" "),
                      customer: job.customers?.name,
                      customerId: job.customer_id,
                      phone: job.customers?.phone ?? undefined,
                      invoiced: invoicedSet.has(job.id),
                    })}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${job.id}`} className="flex items-center gap-3">
                        {job.vehicles && (
                          <Morph name={`plate-job-${job.id}`}>
                            <span className="inline-flex shrink-0">
                              <PlateBadge plateNumber={job.vehicles.plate_number} emirate={job.vehicles.emirate} />
                            </span>
                          </Morph>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900">
                            {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ") || "Vehicle"}
                          </span>
                          <span className="block truncate text-xs text-zinc-500 md:hidden">{job.customers?.name}</span>
                          <span className="mt-1 block sm:hidden">
                            <Badge color={STATUS_COLOR[job.status]} dot>
                              {STATUS_LABEL[job.status]}
                            </Badge>
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-700 md:table-cell">{job.customers?.name}</td>
                    <td data-split-hide className="hidden max-w-xs px-4 py-3 lg:table-cell">
                      <span className="block truncate text-zinc-600">{job.description}</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-600 md:table-cell">
                      <InlineEdit
                        label="Mechanic"
                        kind="select"
                        value={job.mechanic_name ?? ""}
                        display={job.mechanic_name ?? <span className="text-zinc-400">Unassigned</span>}
                        options={mechanicOptions(job.mechanic_name)}
                        action={updateJobInline.bind(null, job.id, "mechanic_name")}
                      />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <InlineEdit
                          label="Status"
                          kind="select"
                          value={job.status}
                          display={
                            <Badge color={STATUS_COLOR[job.status]} dot>
                              {STATUS_LABEL[job.status]}
                            </Badge>
                          }
                          options={statusOptions}
                          action={updateJobInline.bind(null, job.id, "status")}
                        />
                        {job.status === "completed" && !invoicedSet.has(job.id) && <Badge color="amber">Needs invoice</Badge>}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-zinc-500 tabular sm:table-cell">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="pr-3 text-right">
                      <PeekButton type="job" id={job.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!error && allJobs.length === 0 && <EmptyState icon="wrench" title="No job cards yet" message="Open a job card when a car arrives." action={<><Link href="/jobs/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-700">+ New job card</Link></>} />}
        </Card>
        </SplitView>
      )}
    </div>
  );
}
