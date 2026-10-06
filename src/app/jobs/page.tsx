import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton, SegmentedLinks, theadClass, thClass } from "@/components/ui";
import { JobsBoard } from "@/components/JobsBoard";
import { PlateBadge } from "@/components/PlateBadge";
import { updateJobStatus } from "@/app/jobs/actions";

type JobRow = {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  mechanic_name: string | null;
  created_at: string;
  vehicles: { plate_number: string; emirate: string; make: string | null; model: string | null } | null;
  customers: { name: string } | null;
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
      "id, description, status, mechanic_name, created_at, vehicles(plate_number, emirate, make, model), customers(name)"
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: jobs, error } = await query.returns<JobRow[]>();

  const { data: invoicedJobIds } = await supabase
    .from("invoices")
    .select("job_card_id")
    .not("job_card_id", "is", null);
  const invoicedSet = new Set((invoicedJobIds ?? []).map((i) => i.job_card_id));

  const allJobs = jobs ?? [];
  const uninvoicedIds = allJobs.filter((j) => j.status === "completed" && !invoicedSet.has(j.id)).map((j) => j.id);
  const statusHref = (s: string) =>
    s ? `/jobs?status=${s}${view ? `&view=${view}` : ""}` : `/jobs${view ? `?view=${view}` : ""}`;

  return (
    <div className="page">
      <PageHeader
        title="Job Cards"
        description="Every vehicle in for service, from check-in to invoice."
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
            <EmptyState icon="wrench" message="No job cards yet." />
          </Card>
        ) : (
          <JobsBoard jobs={allJobs} uninvoicedIds={uninvoicedIds} updateJobStatus={updateJobStatus} />
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Vehicle</th>
                  <th className={`${thClass} hidden md:table-cell`}>Customer</th>
                  <th className={`${thClass} hidden lg:table-cell`}>Work</th>
                  <th className={`${thClass} hidden md:table-cell`}>Mechanic</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} hidden sm:table-cell text-right`}>Opened</th>
                </tr>
              </thead>
              <tbody>
                {allJobs.map((job) => (
                  <tr key={job.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${job.id}`} className="flex items-center gap-3">
                        {job.vehicles && <PlateBadge plateNumber={job.vehicles.plate_number} emirate={job.vehicles.emirate} />}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900">
                            {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ") || "Vehicle"}
                          </span>
                          <span className="block truncate text-xs text-zinc-500 md:hidden">{job.customers?.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-700 md:table-cell">{job.customers?.name}</td>
                    <td className="hidden max-w-xs px-4 py-3 lg:table-cell">
                      <span className="block truncate text-zinc-600">{job.description}</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-600 md:table-cell">{job.mechanic_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Badge color={STATUS_COLOR[job.status]} dot>
                          {STATUS_LABEL[job.status]}
                        </Badge>
                        {job.status === "completed" && !invoicedSet.has(job.id) && <Badge color="amber">Needs invoice</Badge>}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-zinc-500 tabular sm:table-cell">
                      {new Date(job.created_at).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!error && allJobs.length === 0 && <EmptyState icon="wrench" message="No job cards yet." />}
        </Card>
      )}
    </div>
  );
}
