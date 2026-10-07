"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { invoiceFigures } from "@/lib/invoice-math";

export async function applyJobTemplate(invoiceId: string, formData: FormData) {
  const supabase = await createClient();
  const templateId = String(formData.get("template_id") ?? "").trim();
  if (!templateId) {
    throw new Error("Select a template first.");
  }

  const { data: templateItems, error } = await supabase
    .from("job_template_items")
    .select("description, item_type, quantity, unit_price")
    .eq("template_id", templateId)
    .order("sort_order");

  if (error) {
    throw new Error(error.message);
  }

  if (templateItems && templateItems.length > 0) {
    const { error: insertError } = await supabase.from("invoice_items").insert(
      templateItems.map((item) => ({
        invoice_id: invoiceId,
        description: item.description,
        item_type: item.item_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))
    );
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  await recalculateInvoiceStatus(invoiceId);
  await logAudit("invoice.apply_template", "invoice", invoiceId, { template_id: templateId });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/estimates/${invoiceId}`);
}

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

/** Paid / part paid / unpaid / credited — from items, VAT, discount, payments (net of refunds) and credit notes. */
export async function recalculateInvoiceStatus(invoiceId: string) {
  const supabase = await createClient();

  const [{ data: items }, { data: invoice }, { data: payments }, { data: credits }] = await Promise.all([
    supabase.from("invoice_items").select("quantity, unit_price").eq("invoice_id", invoiceId),
    supabase.from("invoices").select("vat_rate, discount").eq("id", invoiceId).single(),
    supabase.from("payments").select("amount").eq("invoice_id", invoiceId),
    supabase.from("credit_notes").select("amount").eq("invoice_id", invoiceId),
  ]);

  const f = invoiceFigures({
    vat_rate: invoice?.vat_rate ?? 5,
    discount: invoice?.discount ?? 0,
    invoice_items: items ?? [],
    payments: payments ?? [],
    credit_notes: credits ?? [],
  });

  const status =
    f.credited > 0.01 && f.credited >= f.total - 0.01
      ? "credited"
      : f.balance <= 0.01 && f.total > 0
        ? "paid"
        : f.paid > 0.01 || f.credited > 0.01
          ? "partial"
          : "unpaid";

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
