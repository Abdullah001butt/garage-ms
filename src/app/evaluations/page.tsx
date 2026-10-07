import Link from "next/link";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { VehicleEvaluation } from "@/lib/types";
import { Card, PageHeader, EmptyState, PrimaryButton, inputClass, theadClass, thClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { RowMenu, RowMenuDelete, RowMenuLink, RowMenuSeparator } from "@/components/RowMenu";
import { deleteVehicleEvaluation } from "@/app/evaluations/actions";

function valueRange(ev: VehicleEvaluation) {
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (ev.estimated_value_min && ev.estimated_value_max) return `AED ${fmt(ev.estimated_value_min)} – ${fmt(ev.estimated_value_max)}`;
  if (ev.estimated_value_min) return `AED ${fmt(ev.estimated_value_min)}`;
  return "—";
}

export default async function EvaluationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: evaluations, error } = await supabase
    .from("vehicle_evaluations")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<VehicleEvaluation[]>();

  const needle = (q ?? "").trim().toLowerCase();
  const rows = (evaluations ?? []).filter(
    (ev) =>
      !needle ||
      [ev.customer_name, ev.make_model, ev.registration_no, ev.ref_number, ev.chassis_no].some((f) => (f ?? "").toLowerCase().includes(needle))
  );

  return (
    <div className="page">
      <PageHeader
        title="Vehicle Evaluations"
        description="Valuation and inspection reports, ready to print or send by WhatsApp."
        action={
          <Link href="/evaluations/new">
            <PrimaryButton type="button">+ New Evaluation</PrimaryButton>
          </Link>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">Failed to load evaluations: {error.message}</p>}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-3">
          <p className="px-1 text-[13px] text-zinc-500">
            {rows.length} report{rows.length === 1 ? "" : "s"}
          </p>
          <form className="relative w-full sm:w-72">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input type="text" name="q" defaultValue={q ?? ""} placeholder="Filter by customer, vehicle, ref…" className={`${inputClass} pl-8`} />
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Reference</th>
                <th className={thClass}>Vehicle</th>
                <th className={`${thClass} hidden md:table-cell`}>Customer</th>
                <th className={`${thClass} hidden lg:table-cell text-right`}>Estimated value</th>
                <th className={`${thClass} hidden sm:table-cell`}>Date</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/evaluations/${ev.id}`} className="font-mono text-[13px] font-medium text-zinc-900 hover:underline">
                      {ev.ref_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/evaluations/${ev.id}`} className="font-medium text-zinc-900">
                      {ev.make_model}
                    </Link>
                    {ev.registration_no && <p className="text-xs text-zinc-500">{ev.registration_no}</p>}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-700 md:table-cell">{ev.customer_name}</td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-900 tabular lg:table-cell">{valueRange(ev)}</td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-500 tabular sm:table-cell">{formatDate(ev.evaluation_date)}</td>
                  <td className="px-3 py-3">
                    <RowMenu>
                      <RowMenuLink href={`/evaluations/${ev.id}`} icon="file">
                        Open report
                      </RowMenuLink>
                      <RowMenuSeparator />
                      <RowMenuDelete
                        action={deleteVehicleEvaluation.bind(null, ev.id)}
                        confirmMessage={`Delete evaluation ${ev.ref_number}?`}
                        successMessage="Evaluation deleted."
                      />
                    </RowMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!error && rows.length === 0 && (
          <EmptyState icon="file" message={needle ? "No reports match this filter." : "No evaluation reports yet. Create your first one."} />
        )}
      </Card>
    </div>
  );
}
