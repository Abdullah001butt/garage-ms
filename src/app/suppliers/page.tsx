import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Supplier, SupplierEntry } from "@/lib/types";
import { createSupplier } from "@/app/suppliers/actions";
import { Alert, EmptyState, Field, PageHeader, PrimaryButton, StatCard, Card, tdClass, thClass, theadClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SlideOver } from "@/components/SlideOver";
import { supplierBalances } from "@/lib/suppliers";
import { aed } from "@/lib/salary";
import { formatDate } from "@/lib/format";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: newParam } = await searchParams;
  const supabase = await createClient();
  const [{ data: suppliers, error }, { data: entries }] = await Promise.all([
    supabase.from("suppliers").select("*").order("name").returns<Supplier[]>(),
    supabase.from("supplier_entries").select("supplier_id, kind, amount, entry_date").returns<Pick<SupplierEntry, "supplier_id" | "kind" | "amount" | "entry_date">[]>(),
  ]);

  const balances = supplierBalances(entries ?? []);
  const lastEntry = new Map<string, string>();
  for (const e of entries ?? []) {
    if (!lastEntry.has(e.supplier_id) || e.entry_date > lastEntry.get(e.supplier_id)!) lastEntry.set(e.supplier_id, e.entry_date);
  }
  const list = (suppliers ?? []).map((s) => ({ ...s, balance: balances.get(s.id) ?? 0 })).sort((a, b) => b.balance - a.balance);
  const totalOwed = list.reduce((sum, s) => sum + Math.max(0, s.balance), 0);
  const owing = list.filter((s) => s.balance > 0.01).length;
  const month = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }).slice(0, 7);
  const paidThisMonth = (entries ?? []).filter((e) => e.kind === "payment" && e.entry_date.startsWith(month)).reduce((s, e) => s + Number(e.amount), 0);
  const boughtThisMonth = (entries ?? []).filter((e) => e.kind === "purchase" && e.entry_date.startsWith(month)).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="page">
      <PageHeader
        title="Suppliers"
        description="Parts shops and vendors, what we bought on credit and what we still owe."
        action={
          <SlideOver id="new-supplier" defaultOpen={newParam === "1"} title="Add supplier" description="A parts shop or vendor you buy from." triggerLabel="Add supplier">
            <form action={createSupplier} className="space-y-4">
              <Field label="Supplier name" name="name" required placeholder="e.g. Al Noor Auto Spare Parts" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone" name="phone" placeholder="06 123 4567" />
                <Field label="Contact person" name="contact_person" />
              </div>
              <Field label="Opening balance we owe (AED)" name="opening_balance" type="number" step="0.01" placeholder="0" />
              <Field label="Notes" name="notes" placeholder="e.g. Credit 30 days, Industrial Area 2" />
              <PrimaryButton type="submit" className="w-full">
                Add supplier
              </PrimaryButton>
            </form>
          </SlideOver>
        }
      />

      {error && (
        <Alert tone="warning" className="mb-6" title="One-time database update needed">
          Run <code className="font-mono">schema_phase30_salaries_suppliers_counter.sql</code> in the Supabase SQL editor to switch on supplier accounts.
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="We owe suppliers" value={aed(totalOwed)} hint={`${owing} supplier${owing === 1 ? "" : "s"} unpaid`} accent={totalOwed > 0 ? "red" : "slate"} />
        <StatCard label="Bought this month" value={aed(boughtThisMonth)} hint="On credit" />
        <StatCard label="Paid this month" value={aed(paidThisMonth)} hint="To suppliers" accent="green" />
        <StatCard label="Suppliers" value={String(list.length)} hint="On file" />
      </div>

      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState icon="package" title="No suppliers yet" message="Add the parts shops you buy from on credit to track what you owe each one." action={<><Link href="/suppliers?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-700">+ Add supplier</Link></>} />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Supplier</th>
                  <th className={`${thClass} hidden md:table-cell`}>Phone</th>
                  <th className={`${thClass} hidden sm:table-cell`}>Last activity</th>
                  <th className={`${thClass} text-right`}>We owe</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="group border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                    <td className={tdClass}>
                      <Link href={`/suppliers/${s.id}`} className="font-medium text-zinc-900 hover:underline">
                        {s.name}
                      </Link>
                      {s.contact_person && <p className="text-xs text-zinc-500">{s.contact_person}</p>}
                    </td>
                    <td className={`${tdClass} hidden tabular md:table-cell`}>{s.phone ?? "—"}</td>
                    <td className={`${tdClass} hidden text-zinc-500 sm:table-cell`}>{lastEntry.has(s.id) ? formatDate(lastEntry.get(s.id)) : "—"}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right font-medium tabular`}>
                      {s.balance > 0.01 ? (
                        <span className="text-red-700">{aed(s.balance)}</span>
                      ) : s.balance < -0.01 ? (
                        <span className="text-emerald-700">{aed(-s.balance)} credit</span>
                      ) : (
                        <span className="text-zinc-400">Settled</span>
                      )}
                    </td>
                    <td className="pr-3">
                      <Link href={`/suppliers/${s.id}`} aria-label="Open" className="text-zinc-300 group-hover:text-zinc-500">
                        <Icon name="chevron-right" className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
