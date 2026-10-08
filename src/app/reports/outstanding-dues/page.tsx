import Link from "next/link";
import { formatAed, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { Badge, EmptyState, PageHeader, Panel, tdClass, thClass, theadClass } from "@/components/ui";
import { StatStrip } from "@/components/report-ui";
import { SortHeader, sortRows } from "@/components/SortHeader";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { BulkBar, BulkSelectProvider, RowCheckbox, SelectAllCheckbox } from "@/components/BulkSelect";
import { BulkLinkButton, BulkRemindButton } from "@/components/BulkActions";

type DueInvoice = {
  id: string;
  invoice_number: number | null;
  created_at: string;
  vat_rate: number;
  discount: number;
  status: "unpaid" | "partial" | "paid";
  customer_id: string;
  customers: { name: string; phone: string } | null;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
  credit_notes?: { amount: number }[];
};

const AGING = [
  { key: "0-14", label: "0–14 days", min: 0, max: 14, bar: "bg-emerald-500" },
  { key: "15-30", label: "15–30 days", min: 15, max: 30, bar: "bg-amber-400" },
  { key: "31-60", label: "31–60 days", min: 31, max: 60, bar: "bg-orange-500" },
  { key: "60+", label: "Over 60 days", min: 61, max: Infinity, bar: "bg-red-600" },
];

export default async function OutstandingDuesPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string; age?: string }> }) {
  const { sort = "age", dir = "desc", age } = await searchParams;
  const supabase = await createClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, created_at, vat_rate, discount, status, customer_id, customers(name, phone), invoice_items(quantity, unit_price), payments(amount), credit_notes(amount)")
    .eq("document_type", "invoice")
    .in("status", ["unpaid", "partial"])
    .returns<DueInvoice[]>();

  const nowMs = new Date().getTime();
  const all = (invoices ?? [])
    .map((inv) => {
      const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const total = subtotal + subtotal * (inv.vat_rate / 100) - inv.discount;
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      const credited = (inv.credit_notes ?? []).reduce((s, c) => s + Number(c.amount), 0);
      return { ...inv, total, paid, balanceDue: Math.max(total - credited - paid, 0), daysOld: Math.floor((nowMs - new Date(inv.created_at).getTime()) / 86400000) };
    })
    .filter((r) => r.balanceDue > 0.01);

  const bucket = AGING.find((b) => b.key === age);
  const filtered = bucket ? all.filter((r) => r.daysOld >= bucket.min && r.daysOld <= bucket.max) : all;
  const rows = sortRows(
    filtered,
    (r) => (sort === "customer" ? r.customers?.name : sort === "amount" ? r.balanceDue : sort === "date" ? r.created_at : r.daysOld),
    dir
  );

  const totalOutstanding = all.reduce((s, r) => s + r.balanceDue, 0);
  const aging = AGING.map((b) => {
    const inBucket = all.filter((r) => r.daysOld >= b.min && r.daysOld <= b.max);
    return { ...b, amount: inBucket.reduce((s, r) => s + r.balanceDue, 0), count: inBucket.length };
  });
  const overdue30 = aging.slice(2).reduce((s, b) => s + b.amount, 0);
  const customers = new Set(all.map((r) => r.customer_id)).size;
  const avgAge = all.length ? Math.round(all.reduce((s, r) => s + r.daysOld, 0) / all.length) : 0;

  const qs = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ sort, dir, age, ...params })) if (v) q.set(k, v);
    return `/reports/outstanding-dues?${q.toString()}`;
  };
  const sortHref = (s: string, d: string) => qs({ sort: s, dir: d });

  const targets = rows.map((r) => {
    const firstName = r.customers?.name?.split(" ")[0] ?? "there";
    return {
      id: r.id,
      name: r.customers?.name ?? "Customer",
      phone: r.customers?.phone ?? null,
      detail: `${formatAed(r.balanceDue)} · ${r.daysOld} days`,
      message: `Hi ${firstName}, this is a friendly reminder from Al Bahir Garage that you have an outstanding balance of ${formatAed(r.balanceDue)}. Please let us know if you'd like to settle it. Thank you!`,
    };
  });

  return (
    <div className="page">
      <PageHeader title="Outstanding Dues" description="Unpaid and part-paid invoices by age, with one-tap WhatsApp reminders." />

      {error && <p className="mb-4 text-sm text-red-600">Failed to load: {error.message}</p>}

      <StatStrip
        className="mb-4"
        items={[
          { label: "Total outstanding", value: formatAed(totalOutstanding), tone: totalOutstanding > 0 ? "negative" : "default", hint: `${all.length} invoices` },
          { label: "Overdue 30+ days", value: formatAed(overdue30), tone: overdue30 > 0 ? "warning" : "default", hint: `${aging[2].count + aging[3].count} invoices` },
          { label: "Customers owing", value: String(customers) },
          { label: "Average age", value: `${avgAge} days`, hint: "Since invoice date" },
        ]}
      />

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-zinc-900">Aging</p>
          {bucket && (
            <Link href={qs({ age: undefined })} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
              Clear filter
            </Link>
          )}
        </div>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-zinc-100">
          {totalOutstanding > 0 &&
            aging.map((b) => (b.amount > 0 ? <div key={b.key} className={b.bar} style={{ width: `${(b.amount / totalOutstanding) * 100}%` }} /> : null))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {aging.map((b) => (
            <Link
              key={b.key}
              href={qs({ age: bucket?.key === b.key ? undefined : b.key })}
              className={`rounded-md border px-3 py-2 transition-colors ${bucket?.key === b.key ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`}
            >
              <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className={`h-2 w-2 rounded-sm ${b.bar}`} />
                {b.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular text-zinc-900">{formatAed(b.amount)}</p>
              <p className="text-[11px] text-zinc-400">{b.count} invoices</p>
            </Link>
          ))}
        </div>
      </div>

      <BulkSelectProvider ids={rows.map((r) => r.id)}>
        <Panel title={bucket ? `Invoices · ${bucket.label}` : "Invoices"} count={rows.length}>
          {rows.length === 0 ? (
            <EmptyState icon="check-circle" message={bucket ? "Nothing in this age group." : "No outstanding dues — everything is settled."} />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="w-10 pl-4">
                      <SelectAllCheckbox />
                    </th>
                    <SortHeader label="Customer" field="customer" sort={sort} dir={dir} href={sortHref} defaultDir="asc" />
                    <SortHeader label="Invoice date" field="date" sort={sort} dir={dir} href={sortHref} className="hidden md:table-cell" />
                    <SortHeader label="Age" field="age" sort={sort} dir={dir} href={sortHref} align="right" className="hidden sm:table-cell" />
                    <SortHeader label="Balance due" field="amount" sort={sort} dir={dir} href={sortHref} align="right" />
                    <th className={`${thClass} hidden lg:table-cell`}>Status</th>
                    <th className={`${thClass} hidden text-right sm:table-cell`}>Remind</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                      <td className="w-10 pl-4">
                        <RowCheckbox id={r.id} label={r.customers?.name} />
                      </td>
                      <td className={tdClass}>
                        <Link href={`/invoices/${r.id}`} className="font-medium text-zinc-900 hover:underline">
                          {r.customers?.name ?? "Unknown"}
                        </Link>
                        <p className="text-xs text-zinc-500">
                          <span className="font-semibold">{formatInvoiceNumber(r.invoice_number, r.created_at)}</span>
                          <span className="sm:hidden"> · {r.daysOld}d old</span>
                        </p>
                      </td>
                      <td className={`${tdClass} hidden whitespace-nowrap text-zinc-500 tabular md:table-cell`}>{formatDate(r.created_at)}</td>
                      <td className={`${tdClass} hidden text-right sm:table-cell`}>
                        <Badge color={r.daysOld > 60 ? "red" : r.daysOld > 30 ? "amber" : r.daysOld > 14 ? "slate" : "green"}>{r.daysOld}d</Badge>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right`}>
                        <p className="font-semibold tabular text-zinc-900">{formatAed(r.balanceDue)}</p>
                        {r.paid > 0 && <p className="text-[11px] text-zinc-500 tabular">of {formatAed(r.total)}</p>}
                      </td>
                      <td className={`${tdClass} hidden lg:table-cell`}>
                        <Badge color={r.status === "partial" ? "amber" : "red"} dot>
                          {r.status === "partial" ? "Part paid" : "Unpaid"}
                        </Badge>
                      </td>
                      <td className={`${tdClass} hidden text-right sm:table-cell`}>
                        {r.customers?.phone && <WhatsAppButton phone={r.customers.phone} message={targets[i].message} label="Remind" size="sm" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <BulkBar noun="invoice">
          <BulkRemindButton targets={targets} />
          <BulkLinkButton href="/invoices/export" label="Export" />
        </BulkBar>
      </BulkSelectProvider>
    </div>
  );
}
