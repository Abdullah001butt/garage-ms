"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { invoiceFigures } from "@/lib/invoice-math";
import { recalculateInvoiceStatus } from "@/app/invoices/actions";

const METHODS = ["cash", "card", "bank_transfer", "ziina", "other"];

function refresh(invoiceId: string) {
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/reports/outstanding-dues");
  revalidatePath("/reports/vat");
  revalidatePath("/reports/daily-cashflow");
  revalidatePath("/reports/profit-loss");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/inventory");
}

/**
 * Issues a credit note against an invoice. Optionally hands money back (a refund, stored as a
 * negative payment) and puts the invoice's parts back on the shelf (full cancellation).
 */
export async function createCreditNote(invoiceId: string, formData: FormData) {
  const supabase = await createClient();
  const amount = Math.round(Number(formData.get("amount") ?? 0) * 100) / 100;
  const reason = String(formData.get("reason") ?? "").trim();
  const refundMethod = String(formData.get("refund_method") ?? "none");
  const restock = formData.get("restock") === "on";
  if (!(amount > 0)) throw new Error("Enter the credit amount.");
  if (!reason) throw new Error("Give a reason for the credit note.");

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, customer_id, vat_rate, discount, document_type, invoice_items(part_id, quantity, unit_price), payments(amount), credit_notes(amount)")
    .eq("id", invoiceId)
    .maybeSingle<{
      id: string;
      customer_id: string;
      vat_rate: number;
      discount: number;
      document_type: string;
      invoice_items: { part_id: string | null; quantity: number; unit_price: number }[];
      payments: { amount: number }[];
      credit_notes: { amount: number }[];
    }>();
  if (!inv || inv.document_type !== "invoice") throw new Error("Invoice not found.");

  const f = invoiceFigures(inv);
  const creditable = Math.round((f.total - f.credited) * 100) / 100;
  if (amount > creditable + 0.01) throw new Error(`You can credit at most AED ${creditable.toFixed(2)} on this invoice.`);

  // Money can only be refunded up to what was actually paid (net of earlier refunds).
  const refund_amount = METHODS.includes(refundMethod) ? Math.min(amount, Math.max(f.paid, 0)) : 0;
  const vat_amount = Math.round(((amount * Number(inv.vat_rate)) / (100 + Number(inv.vat_rate))) * 100) / 100;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle() : { data: null };

  const { data: note, error } = await supabase
    .from("credit_notes")
    .insert({
      invoice_id: invoiceId,
      customer_id: inv.customer_id,
      amount,
      vat_amount,
      reason,
      refund_amount,
      refund_method: refund_amount > 0 ? refundMethod : null,
      restocked: restock,
      created_by: me?.full_name ?? null,
    })
    .select("id, credit_number")
    .single();
  if (error) throw new Error(error.message);

  if (refund_amount > 0) {
    const { error: payError } = await supabase.from("payments").insert({
      invoice_id: invoiceId,
      amount: -refund_amount,
      method: refundMethod,
      notes: `Refund · credit note ${note.credit_number}`,
      credit_note_id: note.id,
    });
    if (payError) {
      await supabase.from("credit_notes").delete().eq("id", note.id);
      throw new Error(payError.message);
    }
  }

  if (restock) {
    for (const item of inv.invoice_items) {
      if (item.part_id) await supabase.rpc("return_part_stock", { p_part_id: item.part_id, p_quantity: item.quantity, p_credit_note: note.id });
    }
  }

  await recalculateInvoiceStatus(invoiceId);
  await logAudit("credit_note.create", "invoice", invoiceId, { amount, refund_amount, reason });
  refresh(invoiceId);
}

/** Removes a credit note (and its refund). Stock that was returned is not taken back automatically. */
export async function deleteCreditNote(invoiceId: string, creditNoteId: string) {
  const supabase = await createClient();
  const { data: note } = await supabase.from("credit_notes").select("amount").eq("id", creditNoteId).maybeSingle();
  const { error } = await supabase.from("credit_notes").delete().eq("id", creditNoteId);
  if (error) throw new Error(error.message);
  await recalculateInvoiceStatus(invoiceId);
  await logAudit("credit_note.delete", "invoice", invoiceId, { amount: note?.amount });
  refresh(invoiceId);
}
