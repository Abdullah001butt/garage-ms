"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createJobTemplate(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name || !description) {
    throw new Error("Name and description are required.");
  }

  const { data: template, error } = await supabase
    .from("job_templates")
    .insert({ name, description })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const items = [];
  for (let i = 0; i < 4; i++) {
    const itemDesc = String(formData.get(`item_description_${i}`) ?? "").trim();
    if (!itemDesc) continue;
    const item_type = String(formData.get(`item_type_${i}`) ?? "part");
    const quantity = Number(formData.get(`item_quantity_${i}`) ?? 1);
    const unit_price = Number(formData.get(`item_price_${i}`) ?? 0);
    items.push({
      template_id: template.id,
      description: itemDesc,
      item_type,
      quantity,
      unit_price,
      sort_order: i,
    });
  }

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("job_template_items").insert(items);
    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  revalidatePath("/job-templates");
  revalidatePath("/jobs/new");
}

export async function updateJobTemplate(templateId: string, formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name || !description) {
    throw new Error("Name and description are required.");
  }

  const { error } = await supabase
    .from("job_templates")
    .update({ name, description })
    .eq("id", templateId);

  if (error) {
    throw new Error(error.message);
  }

  const { error: deleteError } = await supabase
    .from("job_template_items")
    .delete()
    .eq("template_id", templateId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const items = [];
  for (let i = 0; i < 4; i++) {
    const itemDesc = String(formData.get(`item_description_${i}`) ?? "").trim();
    if (!itemDesc) continue;
    const item_type = String(formData.get(`item_type_${i}`) ?? "part");
    const quantity = Number(formData.get(`item_quantity_${i}`) ?? 1);
    const unit_price = Number(formData.get(`item_price_${i}`) ?? 0);
    items.push({
      template_id: templateId,
      description: itemDesc,
      item_type,
      quantity,
      unit_price,
      sort_order: i,
    });
  }

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("job_template_items").insert(items);
    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  revalidatePath("/job-templates");
  revalidatePath("/jobs/new");
}

export async function deleteJobTemplate(templateId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("job_templates").delete().eq("id", templateId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/job-templates");
  revalidatePath("/jobs/new");
}
