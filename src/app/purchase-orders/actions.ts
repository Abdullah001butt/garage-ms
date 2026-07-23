"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

  revalidatePath("/purchase-orders");
  revalidatePath("/inventory");
}
