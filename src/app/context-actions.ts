"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { invoiceFigures } from "@/lib/invoice-math";
import { recalculateInvoiceStatus } from "@/app/invoices/actions";

/** Quick actions behind the right-click menu. Each returns what its Undo needs. */
export type QuickResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

/** Pays off whatever is still owed on an invoice in one go. */
export async function recordFullPayment(invoiceId: string, method: "cash" | "card" | "bank_transfer"): Promise<QuickResult<{ paymentId: string; amount: number }>> {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select("vat_rate, discount, document_type, invoice_items(quantity, unit_price), payments(amount), credit_notes(amount)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return fail("Invoice not found.");
  if (inv.document_type !== "invoice") return fail("Estimates can’t take payments. Convert it to an invoice first.");
  const balance = Math.round(invoiceFigures(inv).balance * 100) / 100;
  if (balance <= 0) return fail("Nothing is owed on this invoice.");

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({ invoice_id: invoiceId, amount: balance, method, notes: "Recorded from quick menu" })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recalculateInvoiceStatus(invoiceId);
  await logAudit("payment.record", "invoice", invoiceId, { amount: balance, method, via: "quick menu" });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/dashboard");
  return { ok: true, paymentId: payment.id, amount: balance };
}

/** "Book again": a fresh pending job for the same car, customer and work. */
export async function duplicateJob(jobId: string): Promise<QuickResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("job_cards")
    .select("vehicle_id, customer_id, description, mechanic_name, driver_customer_id, driver_name")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return fail("Job card not found.");
  const { data: copy, error } = await supabase.from("job_cards").insert({ ...job, status: "pending" }).select("id").single();
  if (error) return fail(error.message);
  await logAudit("job.create", "job_card", copy.id, { copied_from: jobId });
  revalidatePath("/jobs");
  return { ok: true, id: copy.id };
}

/** Copies an invoice or estimate's lines into a new estimate (handy for repeat work and quotes). */
export async function duplicateAsEstimate(invoiceId: string): Promise<QuickResult<{ id: string }>> {
  const supabase = await createClient();
  const { data: src } = await supabase
    .from("invoices")
    .select("customer_id, vat_rate, invoice_items(description, item_type, quantity, unit_price, part_id, warranty_days)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!src) return fail("Document not found.");
  const { data: est, error } = await supabase
    .from("invoices")
    .insert({ customer_id: src.customer_id, document_type: "estimate", vat_rate: src.vat_rate })
    .select("id")
    .single();
  if (error) return fail(error.message);
  const items = (src.invoice_items ?? []).map((it) => ({ ...it, invoice_id: est.id }));
  if (items.length) {
    const { error: itemErr } = await supabase.from("invoice_items").insert(items);
    if (itemErr) {
      await supabase.from("invoices").delete().eq("id", est.id);
      return fail(itemErr.message);
    }
  }
  await logAudit("estimate.create", "invoice", est.id, { copied_from: invoiceId });
  revalidatePath("/estimates");
  return { ok: true, id: est.id };
}

/** Undo for duplicateAsEstimate — only ever removes an estimate, never a tax invoice. */
export async function removeEstimate(estimateId: string): Promise<QuickResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", estimateId).eq("document_type", "estimate");
  if (error) return fail(error.message);
  revalidatePath("/estimates");
  return { ok: true };
}
