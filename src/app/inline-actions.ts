"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { recalculateInvoiceStatus } from "@/app/invoices/actions";
import type { JobStatus } from "@/lib/types";

/** Result of a click-to-edit save. Errors come back as a message instead of a thrown exception. */
export type InlineResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): InlineResult => ({ ok: false, error });

function money(raw: string) {
  const n = Number(raw.replace(/,/g, "").trim());
  return raw.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/* ───────── Parts stock table ───────── */
export async function updatePartInline(partId: string, field: "stock_qty" | "unit_cost" | "unit_price" | "reorder_threshold", raw: string): Promise<InlineResult> {
  const supabase = await createClient();
  const value = money(raw);
  if (value === null) return fail("Enter a number of 0 or more.");

  if (field === "stock_qty") {
    if (!Number.isInteger(value)) return fail("Stock must be a whole number.");
    const { error } = await supabase.rpc("adjust_part_stock", { p_part_id: partId, p_new_qty: value, p_note: "Edited in the stock table" });
    if (error) return fail(error.message);
  } else {
    if (field === "reorder_threshold" && !Number.isInteger(value)) return fail("Reorder level must be a whole number.");
    const { error } = await supabase.from("parts").update({ [field]: value }).eq("id", partId);
    if (error) return fail(error.message);
  }
  await logAudit("part.update", "part", partId, { [field]: value, via: "inline" });
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${partId}`);
  return { ok: true };
}

/* ───────── Job cards list ───────── */
const STATUSES: JobStatus[] = ["pending", "in_progress", "completed"];

export async function updateJobInline(jobId: string, field: "status" | "mechanic_name", raw: string): Promise<InlineResult> {
  const supabase = await createClient();
  if (field === "status") {
    if (!STATUSES.includes(raw as JobStatus)) return fail("Unknown status.");
    const { error } = await supabase
      .from("job_cards")
      .update({ status: raw, completed_at: raw === "completed" ? new Date().toISOString() : null })
      .eq("id", jobId);
    if (error) return fail(error.message);
    await logAudit("job.status_change", "job_card", jobId, { new_status: raw, via: "inline" });
  } else {
    const mechanic = raw.trim() || null;
    const { error } = await supabase.from("job_cards").update({ mechanic_name: mechanic }).eq("id", jobId);
    if (error) return fail(error.message);
    await logAudit("job.update", "job_card", jobId, { mechanic_name: mechanic, via: "inline" });
  }
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/today");
  return { ok: true };
}

/* ───────── Invoice / estimate line items ───────── */
export async function updateInvoiceItemInline(invoiceId: string, itemId: string, field: "description" | "quantity" | "unit_price", raw: string): Promise<InlineResult> {
  const supabase = await createClient();
  const [{ data: inv }, { count: credits }] = await Promise.all([
    supabase.from("invoices").select("status, document_type").eq("id", invoiceId).maybeSingle(),
    supabase.from("credit_notes").select("id", { count: "exact", head: true }).eq("invoice_id", invoiceId),
  ]);
  if (!inv) return fail("Invoice not found.");
  if (inv.status === "credited" || (credits ?? 0) > 0) return fail("This invoice has a credit note, so its lines are locked. Issue another credit note instead.");

  let update: Record<string, string | number>;
  if (field === "description") {
    const text = raw.trim();
    if (!text) return fail("Description can’t be empty.");
    update = { description: text };
  } else {
    const value = money(raw);
    if (value === null) return fail("Enter a number of 0 or more.");
    if (field === "quantity" && value <= 0) return fail("Quantity must be more than 0.");
    update = { [field]: value };
  }

  const { data: before } = await supabase.from("invoice_items").select("description, quantity, unit_price").eq("id", itemId).eq("invoice_id", invoiceId).maybeSingle();
  if (!before) return fail("Line not found.");
  const { error } = await supabase.from("invoice_items").update(update).eq("id", itemId).eq("invoice_id", invoiceId);
  if (error) return fail(error.message);

  await recalculateInvoiceStatus(invoiceId);
  await logAudit("invoice_item.update", "invoice", invoiceId, { before, after: update });
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/estimates/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  return { ok: true };
}
