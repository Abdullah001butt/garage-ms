import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton } from "@/components/ui";

type JobRow = {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  created_at: string;
  vehicles: { plate_number: string; make: string | null; model: string | null } | null;
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
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("job_cards")
    .select(
      "id, description, status, created_at, vehicles(plate_number, make, model), customers(name)"
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: jobs, error } = await query.returns<JobRow[]>();

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Job Cards"
        description="Vehicles currently in for service."
        action={
          <Link href="/jobs/new">
            <PrimaryButton type="button">+ New Job Card</PrimaryButton>
          </Link>
        }
      />

      <div className="flex gap-2 mb-6 text-sm">
        {["", "pending", "in_progress", "completed"].map((s) => (
          <Link
            key={s || "all"}
            href={s ? `/jobs?status=${s}` : "/jobs"}
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

      {error && (
        <p className="text-red-600 text-sm mb-4">Failed to load job cards: {error.message}</p>
      )}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {jobs?.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {job.vehicles?.plate_number}
                    {job.vehicles?.make || job.vehicles?.model
                      ? ` — ${[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ")}`
                      : ""}
                  </p>
                  <p className="text-sm text-slate-500">
                    {job.customers?.name} · {job.description}
                  </p>
                </div>
                <Badge color={STATUS_COLOR[job.status]}>{STATUS_LABEL[job.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
        {!error && jobs?.length === 0 && <EmptyState message="No job cards yet." />}
      </Card>
    </div>
  );
}
