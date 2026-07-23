import { createClient } from "@/lib/supabase/server";
import type { PurchaseOrderStatus } from "@/lib/types";
import { updatePurchaseOrderStatus } from "@/app/purchase-orders/actions";
import { Card, PageHeader, Badge, EmptyState, SecondaryButton } from "@/components/ui";

type PORow = {
  id: string;
  quantity: number;
  status: PurchaseOrderStatus;
  created_at: string;
  received_at: string | null;
  parts: { name: string; sku: string | null } | null;
};

const STATUS_COLOR: Record<PurchaseOrderStatus, "amber" | "blue" | "green" | "gray"> = {
  pending: "amber",
  ordered: "blue",
  received: "green",
  cancelled: "gray",
};

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();
  const { data: orders, error } = await supabase
    .from("purchase_orders")
    .select("id, quantity, status, created_at, received_at, parts(name, sku)")
    .order("created_at", { ascending: false })
    .returns<PORow[]>();

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Purchase Orders"
        description="Reorders for low-stock parts. Create these from the Parts Stock page."
      />

      {error && (
        <p className="text-red-600 text-sm mb-4">Failed to load purchase orders: {error.message}</p>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Part</th>
              <th className="px-4 py-2.5 font-medium text-right">Qty</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders?.map((po) => (
              <tr key={po.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {po.parts?.name}
                  {po.parts?.sku && (
                    <span className="text-slate-400 font-normal"> · {po.parts.sku}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">{po.quantity}</td>
                <td className="px-4 py-2.5">
                  <Badge color={STATUS_COLOR[po.status]}>{po.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {new Date(po.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    {po.status === "pending" && (
                      <form action={updatePurchaseOrderStatus.bind(null, po.id, "ordered")}>
                        <SecondaryButton type="submit" className="!px-2.5 !py-1 text-xs">
                          Mark Ordered
                        </SecondaryButton>
                      </form>
                    )}
                    {po.status === "ordered" && (
                      <form action={updatePurchaseOrderStatus.bind(null, po.id, "received")}>
                        <SecondaryButton type="submit" className="!px-2.5 !py-1 text-xs">
                          Mark Received
                        </SecondaryButton>
                      </form>
                    )}
                    {(po.status === "pending" || po.status === "ordered") && (
                      <form action={updatePurchaseOrderStatus.bind(null, po.id, "cancelled")}>
                        <button className="text-xs text-red-500 hover:underline">Cancel</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders?.length === 0 && <EmptyState message="No purchase orders yet." />}
      </Card>
    </div>
  );
}
