import Link from "next/link";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { PurchaseOrderStatus } from "@/lib/types";
import { updatePurchaseOrderStatus } from "@/app/purchase-orders/actions";
import { Card, PageHeader, Badge, EmptyState, SecondaryButton, SegmentedLinks, theadClass, thClass } from "@/components/ui";
import { RowMenu, RowMenuAction, RowMenuLink, RowMenuSeparator } from "@/components/RowMenu";

type PORow = {
  id: string;
  quantity: number;
  status: PurchaseOrderStatus;
  created_at: string;
  received_at: string | null;
  parts: { name: string; sku: string | null; supplier_name?: string | null } | null;
};

const STATUS_COLOR: Record<PurchaseOrderStatus, "amber" | "blue" | "green" | "gray"> = {
  pending: "amber",
  ordered: "blue",
  received: "green",
  cancelled: "gray",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: orders, error } = await supabase
    .from("purchase_orders")
    .select("id, quantity, status, created_at, received_at, parts(name, sku, supplier_name)")
    .order("created_at", { ascending: false })
    .returns<PORow[]>();

  const all = orders ?? [];
  const isOpen = (o: PORow) => o.status === "pending" || o.status === "ordered";
  const rows = all.filter((o) => (status === "open" ? isOpen(o) : status ? o.status === status : true));
  const count = (v: string) => (v === "" ? all.length : v === "open" ? all.filter(isOpen).length : all.filter((o) => o.status === v).length);

  return (
    <div className="page">
      <PageHeader
        title="Purchase Orders"
        description="Restock orders for parts. Raise new ones from the Order button on Parts Stock."
        action={
          <Link href="/inventory">
            <SecondaryButton type="button" icon="package">
              Parts stock
            </SecondaryButton>
          </Link>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">Failed to load purchase orders: {error.message}</p>}

      <Card className="overflow-hidden">
        <div className="border-b border-zinc-200 p-3">
          <SegmentedLinks
            items={FILTERS.map((f) => ({
              label: `${f.label} (${count(f.value)})`,
              href: f.value ? `/purchase-orders?status=${f.value}` : "/purchase-orders",
              active: (status ?? "") === f.value,
            }))}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Part</th>
                <th className={`${thClass} hidden md:table-cell`}>Supplier</th>
                <th className={`${thClass} text-right`}>Qty</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} hidden sm:table-cell`}>Raised</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {rows.map((po) => (
                <tr key={po.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{po.parts?.name ?? "Deleted part"}</p>
                    {po.parts?.sku && <p className="font-mono text-xs text-zinc-500">{po.parts.sku}</p>}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">{po.parts?.supplier_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-900 tabular">{po.quantity}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[po.status]} dot>
                      {po.status}
                    </Badge>
                    {po.received_at && <p className="mt-0.5 text-xs text-zinc-500">on {formatDate(po.received_at)}</p>}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-500 tabular sm:table-cell">{formatDate(po.created_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {po.status === "pending" && (
                        <form action={updatePurchaseOrderStatus.bind(null, po.id, "ordered")}>
                          <SecondaryButton type="submit" className="h-8 px-2.5 text-[13px]">
                            Mark ordered
                          </SecondaryButton>
                        </form>
                      )}
                      {po.status === "ordered" && (
                        <form action={updatePurchaseOrderStatus.bind(null, po.id, "received")}>
                          <SecondaryButton type="submit" icon="check" className="h-8 px-2.5 text-[13px]">
                            Mark received
                          </SecondaryButton>
                        </form>
                      )}
                      <RowMenu>
                        <RowMenuLink href="/inventory" icon="package">
                          View in parts stock
                        </RowMenuLink>
                        {isOpen(po) && (
                          <>
                            <RowMenuSeparator />
                            <RowMenuAction action={updatePurchaseOrderStatus.bind(null, po.id, "cancelled")} icon="x" successMessage="Purchase order cancelled.">
                              Cancel order
                            </RowMenuAction>
                          </>
                        )}
                      </RowMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <EmptyState icon="package" message={all.length === 0 ? "No purchase orders yet." : "Nothing in this view."} />}
      </Card>
    </div>
  );
}
