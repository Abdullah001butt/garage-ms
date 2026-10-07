"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { dayKey } from "@/lib/format";

function refresh(supplierId?: string) {
  revalidatePath("/suppliers");
  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/today");
  revalidatePath("/expenses");
  revalidatePath("/reports/daily-cashflow");
  revalidatePath("/reports/profit-loss");
}

function supplierFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || null,
    contact_person: String(formData.get("contact_person") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createSupplier(formData: FormData) {
  const supabase = await createClient();
  const fields = supplierFields(formData);
  if (!fields.name) throw new Error("Supplier name is required.");

  const { data: supplier, error } = await supabase.from("suppliers").insert(fields).select("id").single();
  if (error) throw new Error(error.message);

  // Optional opening balance: what we already owe them today.
  const opening = Number(formData.get("opening_balance") || 0);
  if (opening > 0) {
    await supabase.from("supplier_entries").insert({
      supplier_id: supplier.id,
      kind: "purchase",
      amount: opening,
      entry_date: dayKey(new Date()),
      reference: "Opening balance",
    });
  }

  await logAudit("supplier.create", "supplier", supplier.id, { name: fields.name });
  refresh();
  redirect(`/suppliers/${supplier.id}`);
}

export async function updateSupplier(supplierId: string, formData: FormData) {
  const supabase = await createClient();
  const fields = supplierFields(formData);
  if (!fields.name) throw new Error("Supplier name is required.");

  const { error } = await supabase.from("suppliers").update(fields).eq("id", supplierId);
  if (error) throw new Error(error.message);

  await logAudit("supplier.update", "supplier", supplierId, { name: fields.name });
  refresh(supplierId);
}

export async function deleteSupplier(supplierId: string) {
  const supabase = await createClient();
  const { data: supplier } = await supabase.from("suppliers").select("name").eq("id", supplierId).maybeSingle();
  const { error } = await supabase.from("suppliers").delete().eq("id", supplierId);
  if (error) throw new Error(error.message);

  await logAudit("supplier.delete", "supplier", supplierId, { name: supplier?.name });
  refresh();
}

export async function recordSupplierPurchase(supplierId: string, formData: FormData) {
  const supabase = await createClient();
  const amount = Number(formData.get("amount") ?? 0);
  const entry_date = String(formData.get("entry_date") ?? "").trim() || dayKey(new Date());
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!(amount > 0)) throw new Error("Enter the purchase amount.");

  const { error } = await supabase.from("supplier_entries").insert({ supplier_id: supplierId, kind: "purchase", amount, entry_date, reference, note });
  if (error) throw new Error(error.message);

  await logAudit("supplier.purchase", "supplier", supplierId, { amount, reference });
  refresh(supplierId);
}

export async function recordSupplierPayment(supplierId: string, formData: FormData) {
  const supabase = await createClient();
  const amount = Number(formData.get("amount") ?? 0);
  const entry_date = String(formData.get("entry_date") ?? "").trim() || dayKey(new Date());
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  const addExpense = formData.get("add_expense") === "on";
  if (!(amount > 0)) throw new Error("Enter the amount paid.");

  let expense_id: string | null = null;
  if (addExpense) {
    const { data: supplier } = await supabase.from("suppliers").select("name").eq("id", supplierId).maybeSingle();
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        category: "Parts & Supplies",
        description: `Payment to ${supplier?.name ?? "supplier"}${reference ? ` (${reference})` : ""}`,
        amount,
        expense_date: entry_date,
      })
      .select("id")
      .single();
    if (expenseError) throw new Error(expenseError.message);
    expense_id = expense.id;
  }

  const { error } = await supabase
    .from("supplier_entries")
    .insert({ supplier_id: supplierId, kind: "payment", amount, entry_date, reference, note, expense_id });
  if (error) {
    if (expense_id) await supabase.from("expenses").delete().eq("id", expense_id);
    throw new Error(error.message);
  }

  await logAudit("supplier.payment", "supplier", supplierId, { amount, reference });
  refresh(supplierId);
}

export async function deleteSupplierEntry(supplierId: string, entryId: string) {
  const supabase = await createClient();
  const { data: entry } = await supabase.from("supplier_entries").select("*").eq("id", entryId).maybeSingle();
  if (!entry) return;

  const { error } = await supabase.from("supplier_entries").delete().eq("id", entryId);
  if (error) throw new Error(error.message);
  if (entry.expense_id) await supabase.from("expenses").delete().eq("id", entry.expense_id);

  await logAudit("supplier.entry_delete", "supplier", supplierId, { kind: entry.kind, amount: entry.amount });
  refresh(supplierId);
}
