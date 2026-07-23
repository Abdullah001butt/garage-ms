import { createClient } from "@/lib/supabase/server";
import type { Part } from "@/lib/types";
import { createPart, adjustStock } from "@/app/inventory/actions";
import { createPurchaseOrder } from "@/app/purchase-orders/actions";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton, Field, labelClass, inputClass } from "@/components/ui";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: parts, error } = await supabase
    .from("parts")
    .select("*")
    .order("name")
    .returns<Part[]>();

  const lowStock = (parts ?? []).filter((p) => p.stock_qty <= p.reorder_threshold);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <PageHeader
        title="Parts Stock"
        description="Live inventory levels across all parts on the shelf."
      />

      {error && (
        <p className="text-red-600 text-sm mb-4">Failed to load inventory: {error.message}</p>
      )}

      {lowStock.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">
            ⚠ {lowStock.length} part{lowStock.length > 1 ? "s" : ""} at or below reorder threshold
          </p>
          <p className="text-xs text-amber-700">
            Create a purchase order below to restock before service delays happen.
          </p>
        </Card>
      )}

      <Card className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium text-right">Stock</th>
              <th className="px-4 py-2.5 font-medium text-right">Cost</th>
              <th className="px-4 py-2.5 font-medium text-right">Price</th>
              <th className="px-4 py-2.5 font-medium">Update Stock</th>
              <th className="px-4 py-2.5 font-medium">Reorder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parts?.map((part) => {
              const isLow = part.stock_qty <= part.reorder_threshold;
              return (
                <tr key={part.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{part.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{part.sku ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {isLow ? (
                      <Badge color="red">{part.stock_qty} low</Badge>
                    ) : (
                      part.stock_qty
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">{part.unit_cost?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{part.unit_price?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <form action={adjustStock.bind(null, part.id)} className="flex gap-2">
                      <input
                        type="number"
                        name="stock_qty"
                        defaultValue={part.stock_qty}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2.5">
                    <form action={createPurchaseOrder.bind(null, part.id)} className="flex gap-2">
                      <input
                        type="number"
                        name="quantity"
                        placeholder="Qty"
                        defaultValue={isLow ? Math.max(part.reorder_threshold * 2, 10) : ""}
                        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                      >
                        Order
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {parts?.length === 0 && <EmptyState message="No parts yet." />}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">Add a part</p>
        <form action={createPart} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block col-span-2">
            <span className={labelClass}>Name</span>
            <input type="text" name="name" required className={inputClass} />
          </label>
          <Field label="SKU" name="sku" />
          <Field label="Stock Qty" name="stock_qty" type="number" defaultValue={0} />
          <Field label="Reorder Threshold" name="reorder_threshold" type="number" defaultValue={5} />
          <Field label="Unit Cost" name="unit_cost" type="number" step="0.01" />
          <Field label="Unit Price" name="unit_price" type="number" step="0.01" />
          <div className="col-span-2">
            <PrimaryButton type="submit">Add Part</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
