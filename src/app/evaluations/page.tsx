import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { VehicleEvaluation } from "@/lib/types";
import { Card, PageHeader, EmptyState, PrimaryButton } from "@/components/ui";

export default async function EvaluationsPage() {
  const supabase = await createClient();
  const { data: evaluations, error } = await supabase
    .from("vehicle_evaluations")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Vehicle Evaluation Reports"
        description="Generate and store vehicle valuation reports for customers."
        action={
          <Link href="/evaluations/new">
            <PrimaryButton type="button">+ New Evaluation</PrimaryButton>
          </Link>
        }
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load evaluations: {error.message}</p>}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {(evaluations as VehicleEvaluation[] | null)?.map((ev) => (
            <li key={ev.id}>
              <Link href={`/evaluations/${ev.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {ev.make_model} <span className="text-slate-400 font-normal">— {ev.registration_no}</span>
                  </p>
                  <p className="text-sm text-slate-500 truncate">
                    {ev.customer_name} · {ev.ref_number}
                  </p>
                </div>
                <p className="text-xs text-slate-400 shrink-0">
                  {new Date(ev.evaluation_date).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        {!error && evaluations?.length === 0 && (
          <EmptyState message="No evaluation reports yet. Create your first one." />
        )}
      </Card>
    </div>
  );
}
