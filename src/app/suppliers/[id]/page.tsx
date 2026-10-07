import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Part, Supplier, SupplierEntry } from "@/lib/types";
import {
  deleteSupplier,
  deleteSupplierEntry,
  recordSupplierPayment,
  recordSupplierPurchase,
  updateSupplier,
} from "@/app/suppliers/actions";
import { Field, PageHeader, Panel, PanelEmpty, PrimaryButton, tdClass, thClass, theadClass } from "@/components/ui";
import { SlideOver } from "@/components/SlideOver";
import { RowMenu, RowMenuDelete, RowMenuOpenPanel, RowMenuSeparator } from "@/components/RowMenu";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { aed } from "@/lib/salary";
import { dayKey, formatDate } from "@/lib/format";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: supplier }, { data: entries }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).maybeSingle<Supplier>(),
    supabase
      .from("supplier_entries")
      .select("*")
      .eq("supplier_id", id)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<SupplierEntry[]>(),
  ]);
  if (!supplier) notFound();

  const { data: parts } = await supabase
    .from("parts")
    .select("id, name, sku, stock_qty")
    .ilike("supplier_name", `%${supplier.name.replace(/[%_]/g, "")}%`)
    .order("name")
    .returns<Pick<Part, "id" | "name" | "sku" | "stock_qty">[]>();

  // Running balance, oldest first; shown newest first.
  const ledger = (entries ?? []).reduce<(SupplierEntry & { balance: number })[]>((rows, e) => {
    const previous = rows.length ? rows[rows.length - 1].balance : 0;
    return [...rows, { ...e, balance: previous + (e.kind === "purchase" ? Number(e.amount) : -Number(e.amount)) }];
  }, []);
  const balance = ledger.length ? ledger[ledger.length - 1].balance : 0;
  const purchases = (entries ?? []).filter((e) => e.kind === "purchase").reduce((s, e) => s + Number(e.amount), 0);
  const paid = (entries ?? []).filter((e) => e.kind === "payment").reduce((s, e) => s + Number(e.amount), 0);
  const today = dayKey(new Date());

  return (
    <div className="page">
      <Link href="/suppliers" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to suppliers
      </Link>
      <PageHeader
        title={supplier.name}
        description={[supplier.contact_person, supplier.phone, supplier.notes].filter(Boolean).join(" · ") || "Supplier account"}
        action={
          <>
            {supplier.phone && (
              <WhatsAppButton
                phone={supplier.phone}
                label="WhatsApp"
                message={`Assalamu alaikum, this is Al Bahir Garage. Our account balance with you shows ${aed(Math.max(0, balance))}. Please confirm.`}
              />
            )}
            <SlideOver id="supplier-purchase" title="Record purchase" description="Parts bought on credit — adds to what we owe." triggerLabel="Purchase" variant="secondary" triggerIcon="package">
              <form action={recordSupplierPurchase.bind(null, id)} className="space-y-4">
                <Field label="Amount (AED)" name="amount" type="number" step="0.01" required />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date" name="entry_date" type="date" defaultValue={today} required />
                  <Field label="Their invoice no." name="reference" placeholder="e.g. 4512" />
                </div>
                <Field label="What was bought" name="note" placeholder="e.g. Brake pads, oil filters" />
                <PrimaryButton type="submit" className="w-full">
                  Save purchase
                </PrimaryButton>
              </form>
            </SlideOver>
            <SlideOver id="supplier-payment" title="Pay supplier" description="Money paid to this supplier — reduces what we owe." triggerLabel="Pay" triggerIcon="wallet">
              <form action={recordSupplierPayment.bind(null, id)} className="space-y-4">
                <Field label="Amount (AED)" name="amount" type="number" step="0.01" required defaultValue={balance > 0 ? balance.toFixed(2) : undefined} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date" name="entry_date" type="date" defaultValue={today} required />
                  <Field label="Reference" name="reference" placeholder="Cash / cheque no." />
                </div>
                <Field label="Note" name="note" />
                <label className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <input type="checkbox" name="add_expense" defaultChecked className="mt-0.5 rounded border-zinc-300" />
                  <span className="text-[13px] text-zinc-700">
                    <span className="block font-medium text-zinc-900">Also record as an expense</span>
                    Adds it to Expenses as &quot;Parts &amp; Supplies&quot; so cash flow and profit include it. Untick if you already entered it there.
                  </span>
                </label>
                <PrimaryButton type="submit" className="w-full">
                  Save payment
                </PrimaryButton>
              </form>
            </SlideOver>
            <RowMenu label="More">
              <RowMenuOpenPanel panelId="edit-supplier" icon="pencil">Edit supplier</RowMenuOpenPanel>
              <RowMenuSeparator />
              <RowMenuDelete
                action={deleteSupplier.bind(null, id)}
                confirmMessage={`Delete ${supplier.name} and all its purchases and payments? Expenses already recorded stay.`}
                successMessage="Supplier deleted."
                label="Delete supplier"
                redirectTo="/suppliers"
              />
            </RowMenu>
          </>
        }
      />

      <SlideOver id="edit-supplier" hideTrigger title="Edit supplier" triggerLabel="Edit">
        <form action={updateSupplier.bind(null, id)} className="space-y-4">
          <Field label="Supplier name" name="name" required defaultValue={supplier.name} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone" name="phone" defaultValue={supplier.phone ?? ""} />
            <Field label="Contact person" name="contact_person" defaultValue={supplier.contact_person ?? ""} />
          </div>
          <Field label="Notes" name="notes" defaultValue={supplier.notes ?? ""} />
          <PrimaryButton type="submit" className="w-full">
            Save changes
          </PrimaryButton>
        </form>
      </SlideOver>

      <div className="mb-6 grid grid-cols-3 divide-x divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="p-3 sm:p-4">
          <p className="text-xs font-medium text-zinc-500 sm:text-[13px]">We owe</p>
          <p className={`mt-1 whitespace-nowrap text-[15px] font-semibold tabular sm:text-2xl ${balance > 0.01 ? "text-red-700" : "text-emerald-700"}`}>{aed(Math.abs(balance))}</p>
          <p className="text-xs text-zinc-500">{balance < -0.01 ? "They owe us (credit)" : balance > 0.01 ? "Outstanding" : "Settled"}</p>
        </div>
        <div className="p-3 sm:p-4">
          <p className="text-xs font-medium text-zinc-500 sm:text-[13px]">Total bought</p>
          <p className="mt-1 whitespace-nowrap text-[15px] font-semibold tabular text-zinc-900 sm:text-2xl">{aed(purchases)}</p>
        </div>
        <div className="p-3 sm:p-4">
          <p className="text-xs font-medium text-zinc-500 sm:text-[13px]">Total paid</p>
          <p className="mt-1 whitespace-nowrap text-[15px] font-semibold tabular text-zinc-900 sm:text-2xl">{aed(paid)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Account" count={ledger.length}>
          {ledger.length === 0 ? (
            <PanelEmpty message="No purchases or payments yet." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className={`${thClass} hidden sm:table-cell`}>Date</th>
                    <th className={thClass}>Details</th>
                    <th className={`${thClass} hidden text-right sm:table-cell`}>Bought</th>
                    <th className={`${thClass} hidden text-right sm:table-cell`}>Paid</th>
                    <th className={`${thClass} text-right sm:hidden`}>Amount</th>
                    <th className={`${thClass} hidden text-right sm:table-cell`}>Balance</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {[...ledger].reverse().map((e) => (
                    <tr key={e.id} className="border-b border-zinc-100 last:border-0">
                      <td className={`${tdClass} hidden whitespace-nowrap text-zinc-500 tabular sm:table-cell`}>{formatDate(e.entry_date)}</td>
                      <td className={tdClass}>
                        <p className="font-medium text-zinc-900">{e.kind === "purchase" ? "Purchase" : "Payment"}{e.reference ? ` · ${e.reference}` : ""}</p>
                        {e.note && <p className="text-xs text-zinc-500">{e.note}</p>}
                        <p className="text-xs text-zinc-500 tabular sm:hidden">{formatDate(e.entry_date)}</p>
                      </td>
                      <td className={`${tdClass} hidden whitespace-nowrap text-right tabular sm:table-cell`}>{e.kind === "purchase" ? aed(Number(e.amount)) : ""}</td>
                      <td className={`${tdClass} hidden whitespace-nowrap text-right tabular text-emerald-700 sm:table-cell`}>{e.kind === "payment" ? aed(Number(e.amount)) : ""}</td>
                      <td className={`${tdClass} whitespace-nowrap text-right font-medium tabular sm:hidden ${e.kind === "payment" ? "text-emerald-700" : "text-zinc-900"}`}>
                        {e.kind === "payment" ? "− " : "+ "}
                        {aed(Number(e.amount))}
                        <p className="text-[11px] font-normal text-zinc-500">Bal. {aed(e.balance)}</p>
                      </td>
                      <td className={`${tdClass} hidden whitespace-nowrap text-right font-medium tabular text-zinc-900 sm:table-cell`}>{aed(e.balance)}</td>
                      <td className="pr-3 text-right">
                        <RowMenu>
                          <RowMenuDelete
                            action={deleteSupplierEntry.bind(null, id, e.id)}
                            confirmMessage={`Remove this ${e.kind}${e.expense_id ? " and its expense entry" : ""}?`}
                            successMessage="Entry removed."
                            label="Remove"
                          />
                        </RowMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Parts from this supplier" count={parts?.length ?? 0}>
          {(parts?.length ?? 0) === 0 ? (
            <PanelEmpty message="Parts show here when their supplier name on Parts Stock matches this supplier." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {parts!.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0 truncate text-zinc-900">{p.name}</span>
                  <span className="shrink-0 tabular text-zinc-500">{p.stock_qty} in stock</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

    </div>
  );
}
