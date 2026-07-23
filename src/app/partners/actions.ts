"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createPartner(formData: FormData) {
  const supabase = await createClient();

  const full_name = String(formData.get("full_name") ?? "").trim();
  const share_percentage = Number(formData.get("share_percentage") ?? 0);

  if (!full_name || share_percentage <= 0) {
    throw new Error("Name and a positive share percentage are required.");
  }

  const { error } = await supabase.from("partners").insert({ full_name, share_percentage });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/partners");
  revalidatePath("/reports/partners");
}

export async function updatePartnerShare(partnerId: string, formData: FormData) {
  const supabase = await createClient();
  const share_percentage = Number(formData.get("share_percentage") ?? 0);

  const { error } = await supabase
    .from("partners")
    .update({ share_percentage })
    .eq("id", partnerId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/partners");
  revalidatePath("/reports/partners");
}

export async function deletePartner(partnerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("partners").delete().eq("id", partnerId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/partners");
  revalidatePath("/reports/partners");
}
