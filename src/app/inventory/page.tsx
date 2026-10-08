import { createClient } from "@/lib/supabase/server";
import type { Part } from "@/lib/types";
import { createPart, adjustStock, updatePartSupplier, updatePart, deletePart } from "@/app/inventory/actions";
import { createPurchaseOrder } from "@/app/purchase-orders/actions";
import { Card, PageHeader, PrimaryButton, Field, labelClass, inputClass, Alert } from "@/components/ui";
import { SlideOver } from "@/components/SlideOver";
import { InventoryTable } from "@/components/InventoryTable";
import Link from "next/link";
import { Icon } from "@/components/icons";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: parts, error } = await supabase
    .from("parts")
    .select("*")
    .order("name")
    .returns<Part[]>();

  const lowStock = (parts ?? []).filter((p) => p.stock_qty <= p.reorder_threshold);

  return (
    <div className="page">
      <PageHeader
        title="Parts Stock"
        description="Live inventory levels across all parts on the shelf."
        action={
          <>
          <Link href="/import" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50">
            <Icon name="upload" className="h-4 w-4 text-zinc-500" />
            Import
          </Link>
          <SlideOver title="Add a part" description="New stock item with pricing and reorder level." triggerLabel="Add Part">
        <form action={createPart} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block col-span-full">
            <span className={labelClass}>Name</span>
            <input type="text" name="name" required className={inputClass} />
          </label>
          <Field label="SKU" name="sku" />
          <Field label="Stock Qty" name="stock_qty" type="number" defaultValue={0} />
          <Field label="Reorder Threshold" name="reorder_threshold" type="number" defaultValue={5} />
          <Field label="Unit Cost" name="unit_cost" type="number" step="0.01" />
          <Field label="Unit Price" name="unit_price" type="number" step="0.01" />
          <Field label="Supplier Name (optional)" name="supplier_name" />
          <Field label="Supplier Phone (optional)" name="supplier_phone" />
          <div className="col-span-full">
            <PrimaryButton type="submit">Add Part</PrimaryButton>
          </div>
        </form>
          </SlideOver>
          </>
        }
      />

      {error && (
        <p className="text-red-600 text-sm mb-4">Failed to load inventory: {error.message}</p>
      )}

      {lowStock.length > 0 && (
        <Alert
          className="mb-6"
          title={`${lowStock.length} part${lowStock.length > 1 ? "s" : ""} at or below reorder level`}
        >
          Use Order on the row to raise a purchase order before it delays a job.
        </Alert>
      )}

      <Card className="mb-6 overflow-hidden">
        <InventoryTable
          parts={parts ?? []}
          adjustStock={adjustStock}
          createPurchaseOrder={createPurchaseOrder}
          updatePartSupplier={updatePartSupplier}
          updatePart={updatePart}
          deletePart={deletePart}
        />
      </Card>

    </div>
  );
}
