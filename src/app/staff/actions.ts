"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export async function createProfile(formData: FormData) {
  const supabase = await createClient();

  const id = String(formData.get("user_id") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "receptionist") as Role;

  if (!id || !full_name) {
    throw new Error("User ID and name are required.");
  }

  const { error } = await supabase.from("profiles").insert({ id, full_name, role });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/staff");
}

export async function updateProfileRole(profileId: string, formData: FormData) {
  const supabase = await createClient();
  const role = String(formData.get("role") ?? "receptionist") as Role;

  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/staff");
}

export async function deleteProfile(profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").delete().eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/staff");
}
