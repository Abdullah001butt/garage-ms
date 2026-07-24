"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/lib/types";

export async function createProfile(formData: FormData) {
  const supabase = await createClient();

  const id = String(formData.get("user_id") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "receptionist") as Role;
  const monthly_salary = formData.get("monthly_salary")
    ? Number(formData.get("monthly_salary"))
    : null;

  if (!id || !full_name) {
    throw new Error("User ID and name are required.");
  }

  const { error } = await supabase.from("profiles").insert({ id, full_name, role, monthly_salary });

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("staff.create", "profile", id, { full_name, role });

  revalidatePath("/staff");
}

export async function updateProfileRole(profileId: string, formData: FormData) {
  const supabase = await createClient();
  const role = String(formData.get("role") ?? "receptionist") as Role;
  const monthly_salary = formData.get("monthly_salary")
    ? Number(formData.get("monthly_salary"))
    : null;

  const { data: before } = await supabase
    .from("profiles")
    .select("role, monthly_salary")
    .eq("id", profileId)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ role, monthly_salary })
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("staff.update", "profile", profileId, {
    before,
    after: { role, monthly_salary },
  });

  revalidatePath("/staff");
}

export async function deleteProfile(profileId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", profileId)
    .maybeSingle();

  const { error } = await supabase.from("profiles").delete().eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("staff.delete", "profile", profileId, profile ?? undefined);

  revalidatePath("/staff");
}
