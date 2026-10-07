"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type SaleLine = { part_id: string | null; description: string; quantity: number; unit_price: number };

const METHODS = ["cash", "card", "bank_transfer", "ziina", "other"];

export async function createCounterSale(formData: FormData) {
  const supabase = await createClient();

  let lines: SaleLine[] = [];
  try {
    lines = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    throw new Error("Could not read the items in this sale.");
  }
  lines = lines
    .map((l) => ({
      part_id: l.part_id || null,
      description: String(l.description ?? "").trim(),
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
    }))
    .filter((l) => l.description && l.quantity > 0 && l.unit_price >= 0);
  if (lines.length === 0) throw new Error("Add at least one item to the sale.");

  const method = METHODS.includes(String(formData.get("method"))) ? String(formData.get("method")) : "cash";
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerPhone = String(formData.get("customer_phone") ?? "").trim();

  // A named customer (phone given) gets the sale on their own account; otherwise the shared walk-in customer.
  let customerId: string | null = null;
  if (customerPhone) {
    const { data: existing } = await supabase.from("customers").select("id").eq("phone", customerPhone).limit(1).maybeSingle();
    if (existing) {
      customerId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("customers")
        .insert({ name: customerName || "Counter customer", phone: customerPhone })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      customerId = created.id;
    }
  } else {
    const { data: walkIn } = await supabase.from("customers").select("id").eq("is_walk_in", true).limit(1).maybeSingle();
    if (!walkIn) throw new Error("Run the phase 30 database update first (it creates the Walk-in customer).");
    customerId = walkIn.id;
  }

  const { data: settings } = await supabase.from("shop_settings").select("vat_rate").limit(1).maybeSingle();
  const vat_rate = Number(settings?.vat_rate ?? 5);

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({ customer_id: customerId, document_type: "invoice", vat_rate })
    .select("id")
    .single();
  if (invoiceError) throw new Error(invoiceError.message);

  // Parts lines carry part_id, so the stock trigger takes them off the shelf.
  const { error: itemsError } = await supabase.from("invoice_items").insert(
    lines.map((l) => ({
      invoice_id: invoice.id,
      part_id: l.part_id,
      description: l.description,
      item_type: "part",
      quantity: l.quantity,
      unit_price: l.unit_price,
    }))
  );
  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    throw new Error(itemsError.message);
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const total = Math.round(subtotal * (1 + vat_rate / 100) * 100) / 100;

  if (total > 0) {
    const { error: paymentError } = await supabase.from("payments").insert({
      invoice_id: invoice.id,
      amount: total,
      method,
      notes: customerName && !customerPhone ? `Counter sale — ${customerName}` : "Counter sale",
    });
    if (paymentError) throw new Error(paymentError.message);
  }
  await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", invoice.id);

  await logAudit("counter_sale.create", "invoice", invoice.id, { total, method, items: lines.length });

  revalidatePath("/invoices");
  revalidatePath("/inventory");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  revalidatePath("/reports/daily-cashflow");
  redirect(`/invoices/${invoice.id}?sale=1`);
}
