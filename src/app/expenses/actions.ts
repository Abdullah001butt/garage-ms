"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function createExpense(formData: FormData) {
  const supabase = await createClient();

  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const amount = Number(formData.get("amount") ?? 0);
  const expense_date = String(formData.get("expense_date") ?? "").trim();
  const company_vehicle_id = String(formData.get("company_vehicle_id") ?? "").trim() || null;

  if (!category || !amount || !expense_date) {
    throw new Error("Category, amount, and date are required.");
  }

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({ category, description, amount, expense_date, company_vehicle_id })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("expense.create", "expense", expense.id, { category, amount, expense_date });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function updateExpense(expenseId: string, formData: FormData) {
  const supabase = await createClient();

  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const amount = Number(formData.get("amount") ?? 0);
  const expense_date = String(formData.get("expense_date") ?? "").trim();
  const company_vehicle_id = String(formData.get("company_vehicle_id") ?? "").trim() || null;

  if (!category || !amount || !expense_date) {
    throw new Error("Category, amount, and date are required.");
  }

  const { error } = await supabase
    .from("expenses")
    .update({ category, description, amount, expense_date, company_vehicle_id })
    .eq("id", expenseId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("expense.update", "expense", expenseId, { category, amount, expense_date });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function ensureMonthlyExpensesGenerated() {
  const supabase = await createClient();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: templates } = await supabase
    .from("expense_templates")
    .select("*")
    .eq("active", true);

  if (!templates || templates.length === 0) return;

  const { data: existing } = await supabase
    .from("expenses")
    .select("template_id")
    .eq("generated_month", monthStart)
    .not("template_id", "is", null);

  const alreadyGenerated = new Set((existing ?? []).map((e) => e.template_id));
  const toInsert = templates
    .filter((t) => !alreadyGenerated.has(t.id))
    .map((t) => ({
      category: t.category,
      description: t.description,
      amount: t.amount,
      expense_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(t.day_of_month).padStart(2, "0")}`,
      template_id: t.id,
      generated_month: monthStart,
    }));

  if (toInsert.length > 0) {
    await supabase.from("expenses").insert(toInsert);
  }
}

export async function deleteExpense(expenseId: string) {
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("category, amount, expense_date")
    .eq("id", expenseId)
    .maybeSingle();

  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) {
    throw new Error(error.message);
  }

  await logAudit("expense.delete", "expense", expenseId, expense ?? undefined);

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
