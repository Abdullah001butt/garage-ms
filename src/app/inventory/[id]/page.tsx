import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Part } from "@/lib/types";
import { adjustStock } from "@/app/inventory/actions";
import { createPurchaseOrder } from "@/app/purchase-orders/actions";
import { Badge, Field, PageHeader, Panel, PanelEmpty, PrimaryButton, tdClass, thClass, theadClass } from "@/components/ui";
import { StatStrip } from "@/components/report-ui";
import { SlideOver } from "@/components/SlideOver";
import { formatAed, formatDateTime } from "@/lib/format";

type Movement = {
  id: string;
  change: number;
  balance_after: number | null;
  reason: "opening" | "sale" | "return" | "purchase" | "adjustment" | "credit_note";
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  actor_name: string | null;
  created_at: string;
};

const REASON: Record<Movement["reason"], { label: string; color: "green" | "red" | "slate" | "blue" | "amber" | "gray" }> = {
  opening: { label: "Opening", color: "gray" },
  sale: { label: "Sold", color: "red" },
  return: { label: "Returned", color: "green" },
  purchase: { label: "Received", color: "blue" },
  adjustment: { label: "Adjusted", color: "amber" },
  credit_note: { label: "Credit note", color: "green" },
};

function referenceHref(m: Movement) {
  if (!m.reference_id) return null;
  if (m.reference_type === "invoice") return `/invoices/${m.reference_id}`;
  if (m.reference_type === "purchase_order") return "/purchase-orders";
  return null;
}

/** One part: its numbers and every stock movement, newest first. */
export default async function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: part }, { data: movements, error }] = await Promise.all([
    supabase.from("parts").select("*").eq("id", id).maybeSingle<Part>(),
    supabase.from("stock_movements").select("*").eq("part_id", id).order("created_at", { ascending: false }).limit(300).returns<Movement[]>(),
  ]);
  if (!part) notFound();

  const since = new Date().getTime() - 30 * 86400000;
  const recent = (movements ?? []).filter((m) => new Date(m.created_at).getTime() >= since);
  const sold30 = -recent.filter((m) => m.reason === "sale").reduce((s, m) => s + Number(m.change), 0);
  const received30 = recent.filter((m) => m.reason === "purchase").reduce((s, m) => s + Number(m.change), 0);
  const low = part.stock_qty <= part.reorder_threshold;

  return (
    <div className="page">
      <Link href="/inventory" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to parts stock
      </Link>
      <PageHeader
        title={part.name}
        description={[part.sku, part.supplier_name ? `Supplier: ${part.supplier_name}` : null].filter(Boolean).join(" · ") || "Part"}
        action={
          <>
            <SlideOver id="adjust-stock" title="Adjust stock" description="Set the quantity you actually counted. The difference is logged with your note." triggerLabel="Adjust stock" triggerIcon="pencil" variant="secondary">
              <form action={adjustStock.bind(null, part.id)} className="space-y-4">
                <Field label="Quantity on the shelf" name="stock_qty" type="number" defaultValue={part.stock_qty} required />
                <Field label="Reason" name="note" placeholder="e.g. Monthly count, damaged, found extra" required />
                <PrimaryButton type="submit" className="w-full">
                  Save count
                </PrimaryButton>
              </form>
            </SlideOver>
            <SlideOver id="order-part" title={`Order ${part.name}`} description="Creates a purchase order. Receive it later to add stock and the supplier bill." triggerLabel="Order more" triggerIcon="package">
              <form action={createPurchaseOrder.bind(null, part.id)} className="space-y-4">
                <Field label="Quantity" name="quantity" type="number" defaultValue={Math.max(part.reorder_threshold * 2 - part.stock_qty, 1)} required />
                <PrimaryButton type="submit" className="w-full">
                  Create purchase order
                </PrimaryButton>
              </form>
            </SlideOver>
          </>
        }
      />

      <StatStrip
        className="mb-6"
        items={[
          { label: "In stock", value: String(part.stock_qty), tone: low ? "negative" : "default", hint: low ? `At or below reorder level (${part.reorder_threshold})` : `Reorder at ${part.reorder_threshold}` },
          { label: "Sold · last 30 days", value: String(sold30) },
          { label: "Received · last 30 days", value: String(received30) },
          { label: "Stock value (cost)", value: formatAed(part.stock_qty * Number(part.unit_cost ?? 0)), hint: `Cost ${formatAed(Number(part.unit_cost ?? 0))} · price ${formatAed(Number(part.unit_price ?? 0))}` },
        ]}
      />

      <Panel title="Stock history" count={movements?.length ?? 0}>
        {error ? (
          <PanelEmpty message="Stock history isn't switched on yet — run the phase 33 database update." />
        ) : (movements?.length ?? 0) === 0 ? (
          <PanelEmpty message="No movements recorded yet." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>When</th>
                  <th className={thClass}>What happened</th>
                  <th className={`${thClass} text-right`}>Change</th>
                  <th className={`${thClass} hidden text-right sm:table-cell`}>Balance</th>
                  <th className={`${thClass} hidden md:table-cell`}>By</th>
                </tr>
              </thead>
              <tbody>
                {movements!.map((m) => {
                  const href = referenceHref(m);
                  const r = REASON[m.reason] ?? REASON.adjustment;
                  return (
                    <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                      <td className={`${tdClass} whitespace-nowrap text-zinc-500 tabular`}>{formatDateTime(m.created_at)}</td>
                      <td className={tdClass}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge color={r.color}>{r.label}</Badge>
                          {href ? (
                            <Link href={href} className="text-[13px] text-zinc-700 hover:underline">
                              {m.reference_type === "invoice" ? "View invoice" : "Purchase order"}
                            </Link>
                          ) : null}
                        </span>
                        {m.note && <p className="mt-0.5 text-xs text-zinc-500">{m.note}</p>}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right font-semibold tabular ${Number(m.change) > 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {Number(m.change) > 0 ? "+" : ""}
                        {Number(m.change)}
                      </td>
                      <td className={`${tdClass} hidden text-right tabular text-zinc-900 sm:table-cell`}>{m.balance_after ?? "—"}</td>
                      <td className={`${tdClass} hidden text-zinc-500 md:table-cell`}>{m.actor_name ?? "System"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
