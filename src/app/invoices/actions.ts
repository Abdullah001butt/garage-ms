"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

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

  await logAudit("invoice.create", "invoice", invoice.id, { from_job_card: jobCardId });

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

  await logAudit("estimate.create", "invoice", estimate.id);

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

  await logAudit("estimate.convert_to_invoice", "invoice", estimateId);

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
  const warrantyRaw = String(formData.get("warranty_days") ?? "").trim();
  const warranty_days = warrantyRaw ? Number(warrantyRaw) : null;

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
    warranty_days,
  });

  if (error) {
    throw new Error(error.message);
  }

  await recalculateInvoiceStatus(invoiceId);
  await logAudit("invoice_item.add", "invoice", invoiceId, { description, quantity, unit_price });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/estimates/${invoiceId}`);
  revalidatePath("/inventory");
}

export async function deleteInvoiceItem(invoiceId: string, itemId: string) {
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("invoice_items")
    .select("description, quantity, unit_price")
    .eq("id", itemId)
    .maybeSingle();

  const { error } = await supabase.from("invoice_items").delete().eq("id", itemId);

  if (error) {
    throw new Error(error.message);
  }

  await recalculateInvoiceStatus(invoiceId);
  await logAudit("invoice_item.delete", "invoice", invoiceId, item ?? undefined);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/estimates/${invoiceId}`);
}

async function recalculateInvoiceStatus(invoiceId: string) {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("invoice_items")
    .select("quantity, unit_price")
    .eq("invoice_id", invoiceId);

  const { data: invoice } = await supabase
    .from("invoices")
    .select("vat_rate")
    .eq("id", invoiceId)
    .single();

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId);

  const subtotal = (items ?? []).reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const total = subtotal * (1 + (invoice?.vat_rate ?? 5) / 100);
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const status = totalPaid <= 0 ? "unpaid" : totalPaid >= total - 0.01 ? "paid" : "partial";

  await supabase
    .from("invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", invoiceId);
}

export async function recordPayment(invoiceId: string, formData: FormData) {
  const supabase = await createClient();

  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!amount || amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount,
    method,
    notes,
  });

  if (error) {
    throw new Error(error.message);
  }

  await recalculateInvoiceStatus(invoiceId);
  await logAudit("payment.record", "invoice", invoiceId, { amount, method });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function deletePayment(invoiceId: string, paymentId: string) {
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("amount, method")
    .eq("id", paymentId)
    .maybeSingle();

  const { error } = await supabase.from("payments").delete().eq("id", paymentId);

  if (error) {
    throw new Error(error.message);
  }

  await recalculateInvoiceStatus(invoiceId);
  await logAudit("payment.delete", "invoice", invoiceId, payment ?? undefined);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}
