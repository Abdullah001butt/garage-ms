"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LayoutItem } from "@/lib/dashboard-layout";

/** Saves (or with null, resets) the signed-in person's own dashboard arrangement. */
export async function saveDashboardLayout(items: LayoutItem[] | null): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const clean = items
    ? items.slice(0, 40).map((i) => ({ id: String(i.id).slice(0, 40), size: [2, 3, 4, 6].includes(i.size) ? i.size : 6, hidden: !!i.hidden }))
    : null;
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, dashboard_layout: clean ? { v: 1, items: clean } : null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
