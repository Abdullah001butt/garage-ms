"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateShopSettings(settingsId: string, formData: FormData) {
  const supabase = await createClient();

  const shop_name = String(formData.get("shop_name") ?? "").trim();
  const trn = String(formData.get("trn") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const vat_rate = Number(formData.get("vat_rate") ?? 5);
  const portal_url = String(formData.get("portal_url") ?? "").trim() || null;

  const { error } = await supabase
    .from("shop_settings")
    .update({ shop_name, trn, address, phone, vat_rate, portal_url })
    .eq("id", settingsId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}
