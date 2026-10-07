"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { PurchaseOrderStatus } from "@/lib/types";

export async function createPurchaseOrder(partId: string, formData: FormData) {
  const supabase = await createClient();
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!quantity || quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const { error } = await supabase
    .from("purchase_orders")
    .insert({ part_id: partId, quantity });

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("purchase_order.create", "part", partId, { quantity });

  revalidatePath("/purchase-orders");
  revalidatePath("/inventory");
}

export async function updatePurchaseOrderStatus(
  poId: string,
  status: PurchaseOrderStatus
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status,
      received_at: status === "received" ? new Date().toISOString() : null,
    })
    .eq("id", poId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("purchase_order.status_change", "purchase_order", poId, { new_status: status });

  revalidatePath("/purchase-orders");
  revalidatePath("/inventory");
}

/**
 * Marks a purchase order received: stock goes up (database trigger) and, when a supplier
 * is chosen, the purchase is added to that supplier's account on credit.
 */
export async function receivePurchaseOrder(poId: string, formData: FormData) {
  const supabase = await createClient();
  const supplier_id = String(formData.get("supplier_id") ?? "").trim() || null;
  const unitCostRaw = String(formData.get("unit_cost") ?? "").trim();
  const unit_cost = unitCostRaw ? Number(unitCostRaw) : null;
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const onCredit = formData.get("on_credit") === "on";
  const updateCost = formData.get("update_cost") === "on";

  const { data: po } = await supabase.from("purchase_orders").select("id, part_id, quantity, status, parts(name)").eq("id", poId).maybeSingle<{
    id: string;
    part_id: string;
    quantity: number;
    status: PurchaseOrderStatus;
    parts: { name: string } | null;
  }>();
  if (!po) throw new Error("Purchase order not found.");
  if (po.status === "received") throw new Error("This order is already received.");

  let supplier_entry_id: string | null = null;
  if (supplier_id && onCredit && unit_cost && unit_cost > 0) {
    const { data: entry, error: entryError } = await supabase
      .from("supplier_entries")
      .insert({
        supplier_id,
        kind: "purchase",
        amount: Math.round(po.quantity * unit_cost * 100) / 100,
        reference: reference ?? `PO ${poId.slice(0, 8).toUpperCase()}`,
        note: `${po.quantity} × ${po.parts?.name ?? "part"}`,
      })
      .select("id")
      .single();
    if (entryError) throw new Error(entryError.message);
    supplier_entry_id = entry.id;
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "received", received_at: new Date().toISOString(), supplier_id, unit_cost, supplier_entry_id })
    .eq("id", poId);
  if (error) {
    if (supplier_entry_id) await supabase.from("supplier_entries").delete().eq("id", supplier_entry_id);
    throw new Error(error.message);
  }

  if (updateCost && unit_cost && unit_cost > 0) {
    await supabase.from("parts").update({ unit_cost }).eq("id", po.part_id);
  }

  await logAudit("purchase_order.status_change", "purchase_order", poId, { new_status: "received", supplier_id, unit_cost });
  revalidatePath("/purchase-orders");
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${po.part_id}`);
  if (supplier_id) revalidatePath(`/suppliers/${supplier_id}`);
}
