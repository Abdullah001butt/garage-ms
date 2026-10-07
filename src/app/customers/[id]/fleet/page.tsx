import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Vehicle } from "@/lib/types";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui";
import { PlateBadge } from "@/components/PlateBadge";
import { StatStrip } from "@/components/report-ui";
import { formatAed, formatDate } from "@/lib/format";

type JobRow = { id: string; vehicle_id: string; customer_id: string; created_at: string; status: string };
type InvoiceRow = { job_card_id: string | null; customer_id: string; vat_rate: number; discount: number; invoice_items: { quantity: number; unit_price: number }[] };
type EmployeeRow = Pick<Customer, "id" | "name" | "job_title"> & { vehicles: Vehicle[] };

/** Whole-group view of a company: its own cars plus every employee's cars, and who paid for the work. */
export default async function CustomerFleetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: ownVehicles }, { data: employees }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single<Customer>(),
    supabase.from("vehicles").select("*").eq("customer_id", id).returns<Vehicle[]>(),
    supabase.from("customers").select("id, name, job_title, vehicles(*)").eq("parent_customer_id", id).order("name").returns<EmployeeRow[]>(),
  ]);
  if (!customer) notFound();

  const allVehicles = [...(ownVehicles ?? []), ...(employees ?? []).flatMap((e) => e.vehicles)];
  const vehicleIds = allVehicles.map((v) => v.id);
  const { data: jobs } = vehicleIds.length
    ? await supabase.from("job_cards").select("id, vehicle_id, customer_id, created_at, status").in("vehicle_id", vehicleIds).order("created_at", { ascending: false }).returns<JobRow[]>()
    : { data: [] as JobRow[] };
  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: invoices } = jobIds.length
    ? await supabase
        .from("invoices")
        .select("job_card_id, customer_id, vat_rate, discount, invoice_items(quantity, unit_price)")
        .in("job_card_id", jobIds)
        .eq("document_type", "invoice")
        .returns<InvoiceRow[]>()
    : { data: [] as InvoiceRow[] };

  const vehicleOfJob = new Map((jobs ?? []).map((j) => [j.id, j.vehicle_id]));
  const stats = new Map<string, { jobs: number; last: string | null; company: number; personal: number }>();
  for (const v of allVehicles) stats.set(v.id, { jobs: 0, last: null, company: 0, personal: 0 });
  for (const j of jobs ?? []) {
    const st = stats.get(j.vehicle_id);
    if (!st) continue;
    st.jobs += 1;
    if (!st.last || j.created_at > st.last) st.last = j.created_at;
  }
  for (const inv of invoices ?? []) {
    const st = inv.job_card_id ? stats.get(vehicleOfJob.get(inv.job_card_id) ?? "") : null;
    if (!st) continue;
    const sub = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const total = sub * (1 + Number(inv.vat_rate) / 100) - Number(inv.discount);
    if (inv.customer_id === id) st.company += total;
    else st.personal += total;
  }
  const sum = (key: "company" | "personal") => [...stats.values()].reduce((s, v) => s + v[key], 0);

  const groups: { key: string; title: string; subtitle: string; href?: string; vehicles: Vehicle[] }[] = [
    { key: "company", title: "Company cars", subtitle: `Owned by ${customer.name}`, vehicles: ownVehicles ?? [] },
    ...(employees ?? []).map((e) => ({
      key: e.id,
      title: e.name,
      subtitle: e.job_title ?? "Employee",
      href: `/customers/${e.id}`,
      vehicles: e.vehicles,
    })),
  ];

  return (
    <div className="page">
      <Link href={`/customers/${id}`} className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to {customer.name}
      </Link>
      <PageHeader title={`${customer.name} — Fleet`} description="Company cars and every employee's cars, with who paid for the work." />

      <StatStrip
        className="mb-6"
        items={[
          { label: "Cars", value: String(allVehicles.length), hint: `${ownVehicles?.length ?? 0} company · ${allVehicles.length - (ownVehicles?.length ?? 0)} employee` },
          { label: "Jobs", value: String(jobs?.length ?? 0), hint: `${employees?.length ?? 0} employees` },
          { label: "Billed to company", value: formatAed(sum("company")) },
          { label: "Paid by employees", value: formatAed(sum("personal")) },
        ]}
      />

      {allVehicles.length === 0 ? (
        <Panel title="Fleet">
          <EmptyState icon="car" title="No cars yet" message="Add company cars on the Vehicles tab, or add employees with their cars." />
        </Panel>
      ) : (
        <div className="space-y-6">
          {groups
            .filter((g) => g.vehicles.length > 0)
            .map((g) => (
              <Panel
                key={g.key}
                title={g.title}
                count={g.vehicles.length}
                action={
                  g.href ? (
                    <Link href={g.href} className="font-medium text-zinc-500 hover:text-zinc-900">
                      {g.subtitle} →
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-500">{g.subtitle}</span>
                  )
                }
              >
                <ul className="divide-y divide-zinc-100">
                  {g.vehicles.map((v) => {
                    const st = stats.get(v.id)!;
                    return (
                      <li key={v.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                        <Link href={`/vehicles/${v.id}/passport`} className="flex min-w-0 flex-1 items-center gap-3">
                          <PlateBadge plateNumber={v.plate_number} emirate={v.emirate} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-zinc-900">{[v.make, v.model, v.year].filter(Boolean).join(" ") || "Vehicle"}</span>
                            <span className="block text-xs text-zinc-500">
                              {st.jobs} jobs{st.last ? ` · last visit ${formatDate(st.last)}` : ""}
                            </span>
                          </span>
                        </Link>
                        <div className="flex items-center gap-4 sm:justify-end">
                          {g.key !== "company" && (v.company_pays ? <Badge color="indigo">Company pays</Badge> : <Badge color="slate">Employee pays</Badge>)}
                          <dl className="text-right text-[13px]">
                            <dt className="sr-only">Billed to company</dt>
                            <dd className="font-semibold tabular text-zinc-900">{formatAed(st.company)}</dd>
                            {st.personal > 0 && <dd className="text-xs tabular text-zinc-500">+ {formatAed(st.personal)} personal</dd>}
                          </dl>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            ))}
        </div>
      )}
    </div>
  );
}
