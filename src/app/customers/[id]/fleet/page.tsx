import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Vehicle } from "@/lib/types";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { PlateBadge } from "@/components/PlateBadge";

type JobRow = { id: string; vehicle_id: string; created_at: string; status: string };
type InvoiceRow = {
  job_card_id: string | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

export default async function CustomerFleetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: vehicles }, { data: jobs }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single<Customer>(),
    supabase.from("vehicles").select("*").eq("customer_id", id).returns<Vehicle[]>(),
    supabase
      .from("job_cards")
      .select("id, vehicle_id, created_at, status")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .returns<JobRow[]>(),
  ]);

  if (!customer) notFound();

  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: invoices } = jobIds.length
    ? await supabase
        .from("invoices")
        .select("job_card_id, invoice_items(quantity, unit_price)")
        .in("job_card_id", jobIds)
        .eq("document_type", "invoice")
        .returns<InvoiceRow[]>()
    : { data: [] as InvoiceRow[] };

  const jobCardVehicle = new Map((jobs ?? []).map((j) => [j.id, j.vehicle_id]));

  const perVehicle = new Map<string, { jobCount: number; lastJobDate: string | null; totalSpent: number }>();
  for (const v of vehicles ?? []) {
    perVehicle.set(v.id, { jobCount: 0, lastJobDate: null, totalSpent: 0 });
  }
  for (const j of jobs ?? []) {
    const stat = perVehicle.get(j.vehicle_id);
    if (!stat) continue;
    stat.jobCount += 1;
    if (!stat.lastJobDate || new Date(j.created_at) > new Date(stat.lastJobDate)) {
      stat.lastJobDate = j.created_at;
    }
  }
  for (const inv of invoices ?? []) {
    const vehicleId = inv.job_card_id ? jobCardVehicle.get(inv.job_card_id) : null;
    if (!vehicleId) continue;
    const stat = perVehicle.get(vehicleId);
    if (!stat) continue;
    stat.totalSpent += inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  }

  const fleetTotal = [...perVehicle.values()].reduce((s, v) => s + v.totalSpent, 0);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <Link href={`/customers/${id}`} className="text-sm text-indigo-600 hover:underline">
        &larr; Back to {customer.name}
      </Link>

      <PageHeader
        title={`${customer.name} — Fleet Overview`}
        description={`${vehicles?.length ?? 0} vehicle(s) on record · Lifetime spend: AED ${fleetTotal.toFixed(2)}`}
      />

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {vehicles?.map((v) => {
            const stat = perVehicle.get(v.id)!;
            return (
              <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <Link href={`/vehicles/${v.id}/passport`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <PlateBadge plateNumber={v.plate_number} emirate={v.emirate} />
                    {(v.make || v.model) && (
                      <span className="font-medium text-slate-900">
                        {[v.make, v.model, v.year].filter(Boolean).join(" ")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {stat.jobCount} job(s)
                    {stat.lastJobDate && ` · Last visit ${new Date(stat.lastJobDate).toLocaleDateString()}`}
                  </p>
                </Link>
                <p className="shrink-0 text-sm font-semibold text-slate-900">AED {stat.totalSpent.toFixed(2)}</p>
              </li>
            );
          })}
        </ul>
        {vehicles?.length === 0 && <EmptyState message="No vehicles on file for this customer yet." />}
      </Card>
    </div>
  );
}
