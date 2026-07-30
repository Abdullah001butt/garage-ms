import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton } from "@/components/ui";
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
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_COLOR: Record<string, "gray" | "amber" | "green"> = {
  pending: "gray",
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

  return (
    <div className={isBoard ? "mx-auto max-w-6xl p-6 md:p-8" : "mx-auto max-w-4xl p-6 md:p-8"}>
      <PageHeader
        title="Job Cards"
        description="Vehicles currently in for service."
        action={
          <Link href="/jobs/new">
            <PrimaryButton type="button">+ New Job Card</PrimaryButton>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-6 text-sm">
        <div className="flex flex-wrap gap-2">
          {["", "pending", "in_progress", "completed"].map((s) => (
            <Link
              key={s || "all"}
              href={s ? `/jobs?status=${s}${view ? `&view=${view}` : ""}` : `/jobs${view ? `?view=${view}` : ""}`}
              className={`rounded-full px-3 py-1 border ${
                (status ?? "") === s
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              {s ? STATUS_LABEL[s] : "All"}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/jobs${status ? `?status=${status}` : ""}`}
            className={`rounded-full px-3 py-1 border ${
              isBoard ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
            }`}
          >
            Board
          </Link>
          <Link
            href={`/jobs?view=list${status ? `&status=${status}` : ""}`}
            className={`rounded-full px-3 py-1 border ${
              !isBoard ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
            }`}
          >
            List
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-4">Failed to load job cards: {error.message}</p>
      )}

      {isBoard ? (
        (jobs?.length ?? 0) === 0 ? (
          <Card>
            <EmptyState message="No job cards yet." />
          </Card>
        ) : (
          <JobsBoard jobs={jobs ?? []} updateJobStatus={updateJobStatus} />
        )
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {jobs?.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {job.vehicles && (
                        <PlateBadge plateNumber={job.vehicles.plate_number} emirate={job.vehicles.emirate} />
                      )}
                      {(job.vehicles?.make || job.vehicles?.model) && (
                        <span className="font-medium text-slate-900">
                          {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {job.customers?.name} · {job.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {job.status === "completed" && !invoicedSet.has(job.id) && (
                      <Badge color="amber">Needs Invoice</Badge>
                    )}
                    <Badge color={STATUS_COLOR[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {!error && jobs?.length === 0 && <EmptyState message="No job cards yet." />}
        </Card>
      )}
    </div>
  );
}
