"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTemplate(formData: FormData) {
  const supabase = await createClient();

  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const amount = Number(formData.get("amount") ?? 0);
  const day_of_month = Number(formData.get("day_of_month") ?? 1);

  if (!category || !amount) {
    throw new Error("Category and amount are required.");
  }

  const { error } = await supabase
    .from("expense_templates")
    .insert({ category, description, amount, day_of_month });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/expenses/templates");
}

export async function toggleTemplateActive(templateId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_templates")
    .update({ active })
    .eq("id", templateId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/expenses/templates");
}

export async function deleteTemplate(templateId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("expense_templates").delete().eq("id", templateId);
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/expenses/templates");
}
