"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/lib/types";

export type StaffLoginResult = { ok: true; name: string; email: string; password: string } | { ok: false; error: string } | null;

/** Easy to read out or type: e.g. "Bahir-4827-Kx". */
function temporaryPassword() {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  return `Bahir-${randomInt(1000, 9999)}-${letters[randomInt(letters.length)]}${letters[randomInt(letters.length)]}`;
}

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "owner") throw new Error("Only an owner can manage staff logins.");
  return supabase;
}

/** Creates a login (email + temporary password) and the staff profile in one step. */
export async function createStaffLogin(_prev: StaffLoginResult, formData: FormData): Promise<StaffLoginResult> {
  try {
    const supabase = await requireOwner();
    const full_name = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = (String(formData.get("role") ?? "receptionist") as Role) || "receptionist";
    const salaryRaw = String(formData.get("monthly_salary") ?? "").trim();
    const monthly_salary = salaryRaw ? Number(salaryRaw) : null;
    if (!full_name || !email) return { ok: false, error: "Name and email are required." };
    if (!["owner", "receptionist", "mechanic"].includes(role)) return { ok: false, error: "Choose a valid access level." };

    const password = temporaryPassword();
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
    if (error || !data.user) {
      return { ok: false, error: error?.message.includes("already") ? "That email already has a login." : error?.message ?? "Could not create the login." };
    }

    const { error: profileError } = await supabase.from("profiles").insert({ id: data.user.id, full_name, role, monthly_salary });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { ok: false, error: profileError.message };
    }

    await logAudit("staff.create", "profile", data.user.id, { full_name, role, email });
    revalidatePath("/staff");
    return { ok: true, name: full_name, email, password };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create the login." };
  }
}

/** Sets a fresh temporary password for a staff member who forgot theirs. */
export async function resetStaffPassword(_prev: StaffLoginResult, formData: FormData): Promise<StaffLoginResult> {
  try {
    const supabase = await requireOwner();
    const profileId = String(formData.get("profile_id") ?? "");
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", profileId).maybeSingle();
    const admin = createAdminClient();
    const { data: user } = await admin.auth.admin.getUserById(profileId);
    const password = temporaryPassword();
    const { error } = await admin.auth.admin.updateUserById(profileId, { password });
    if (error) return { ok: false, error: error.message };
    await logAudit("staff.password_reset", "profile", profileId, { full_name: profile?.full_name });
    return { ok: true, name: profile?.full_name ?? "Staff member", email: user.user?.email ?? "", password };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reset the password." };
  }
}
