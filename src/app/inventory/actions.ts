"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createPart(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const stock_qty = Number(formData.get("stock_qty") ?? 0);
  const reorder_threshold = Number(formData.get("reorder_threshold") ?? 5);
  const unit_cost = formData.get("unit_cost") ? Number(formData.get("unit_cost")) : null;
  const unit_price = formData.get("unit_price") ? Number(formData.get("unit_price")) : null;

  if (!name) {
    throw new Error("Name is required.");
  }

  const { error } = await supabase
    .from("parts")
    .insert({ name, sku, stock_qty, reorder_threshold, unit_cost, unit_price });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/inventory");
}

export async function adjustStock(partId: string, formData: FormData) {
  const supabase = await createClient();

  const stock_qty = Number(formData.get("stock_qty") ?? 0);

  const { error } = await supabase
    .from("parts")
    .update({ stock_qty })
    .eq("id", partId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/inventory");
}
