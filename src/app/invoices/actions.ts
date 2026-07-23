"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createInvoiceFromJobCard(
  jobCardId: string,
  customerId: string
) {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({ job_card_id: jobCardId, customer_id: customerId, document_type: "invoice" })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/jobs/${jobCardId}`);
  redirect(`/invoices/${invoice.id}`);
}

export async function createEstimate(formData: FormData) {
  const supabase = await createClient();

  const customer_id = String(formData.get("customer_id") ?? "").trim();
  if (!customer_id) {
    throw new Error("Customer is required.");
  }

  const { data: estimate, error } = await supabase
    .from("invoices")
    .insert({ customer_id, document_type: "estimate" })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/estimates");
  redirect(`/estimates/${estimate.id}`);
}

export async function convertEstimateToInvoice(estimateId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ document_type: "invoice", converted_from_estimate_id: estimateId })
    .eq("id", estimateId);

  if (error) {
    throw new Error(error.message);
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("part_id, quantity")
    .eq("invoice_id", estimateId)
    .not("part_id", "is", null);

  for (const item of items ?? []) {
    await supabase.rpc("decrement_stock", { p_part_id: item.part_id, p_quantity: item.quantity });
  }

  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath(`/invoices/${estimateId}`);
  revalidatePath("/estimates");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  redirect(`/invoices/${estimateId}`);
}

export async function addInvoiceItem(invoiceId: string, formData: FormData) {
  const supabase = await createClient();

  const description = String(formData.get("description") ?? "").trim();
  const item_type = String(formData.get("item_type") ?? "part");
  const quantity = Number(formData.get("quantity") ?? 1);
  const unit_price = Number(formData.get("unit_price") ?? 0);
  const part_id = String(formData.get("part_id") ?? "").trim() || null;

  if (!description || !quantity || unit_price < 0) {
    throw new Error("Description, quantity, and unit price are required.");
  }

  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    description,
    item_type,
    quantity,
    unit_price,
    part_id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/estimates/${invoiceId}`);
  revalidatePath("/inventory");
}

export async function deleteInvoiceItem(invoiceId: string, itemId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("invoice_items").delete().eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/estimates/${invoiceId}`);
}

export async function markInvoicePaid(invoiceId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}
