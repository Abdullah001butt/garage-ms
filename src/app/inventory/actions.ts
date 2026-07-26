"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function createPart(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const stock_qty = Number(formData.get("stock_qty") ?? 0);
  const reorder_threshold = Number(formData.get("reorder_threshold") ?? 5);
  const unit_cost = formData.get("unit_cost") ? Number(formData.get("unit_cost")) : null;
  const unit_price = formData.get("unit_price") ? Number(formData.get("unit_price")) : null;
  const supplier_name = String(formData.get("supplier_name") ?? "").trim() || null;
  const supplier_phone = String(formData.get("supplier_phone") ?? "").trim() || null;

  if (!name) {
    throw new Error("Name is required.");
  }

  const { error } = await supabase
    .from("parts")
    .insert({ name, sku, stock_qty, reorder_threshold, unit_cost, unit_price, supplier_name, supplier_phone });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/inventory");
}

export async function updatePart(partId: string, formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const reorder_threshold = Number(formData.get("reorder_threshold") ?? 5);
  const unit_cost = formData.get("unit_cost") ? Number(formData.get("unit_cost")) : null;
  const unit_price = formData.get("unit_price") ? Number(formData.get("unit_price")) : null;

  if (!name) {
    throw new Error("Name is required.");
  }

  const { error } = await supabase
    .from("parts")
    .update({ name, sku, reorder_threshold, unit_cost, unit_price })
    .eq("id", partId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("part.update", "part", partId, { name, sku });

  revalidatePath("/inventory");
}

export async function deletePart(partId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("parts").delete().eq("id", partId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("part.delete", "part", partId);

  revalidatePath("/inventory");
}

export async function updatePartSupplier(partId: string, formData: FormData) {
  const supabase = await createClient();

  const supplier_name = String(formData.get("supplier_name") ?? "").trim() || null;
  const supplier_phone = String(formData.get("supplier_phone") ?? "").trim() || null;

  const { error } = await supabase
    .from("parts")
    .update({ supplier_name, supplier_phone })
    .eq("id", partId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/inventory");
}

export async function adjustStock(partId: string, formData: FormData) {
  const supabase = await createClient();

  const stock_qty = Number(formData.get("stock_qty") ?? 0);

  const { data: before } = await supabase
    .from("parts")
    .select("stock_qty")
    .eq("id", partId)
    .maybeSingle();

  const { error } = await supabase
    .from("parts")
    .update({ stock_qty })
    .eq("id", partId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("part.stock_adjust", "part", partId, {
    before: before?.stock_qty,
    after: stock_qty,
  });

  revalidatePath("/inventory");
}
