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
  const email = String(formData.get("email") ?? "").trim() || null;
  const website = String(formData.get("website") ?? "").trim() || null;
  const facsimile = String(formData.get("facsimile") ?? "").trim() || null;
  const payment_method_note = String(formData.get("payment_method_note") ?? "").trim() || null;
  const payment_instructions = String(formData.get("payment_instructions") ?? "").trim() || null;
  const invoice_disclaimer = String(formData.get("invoice_disclaimer") ?? "").trim() || null;
  const default_service_interval_days = Number(formData.get("default_service_interval_days") ?? 90);
  const google_review_link = String(formData.get("google_review_link") ?? "").trim() || null;

  const { error } = await supabase
    .from("shop_settings")
    .update({
      shop_name,
      trn,
      address,
      phone,
      vat_rate,
      portal_url,
      email,
      website,
      facsimile,
      payment_method_note,
      payment_instructions,
      invoice_disclaimer,
      default_service_interval_days,
      google_review_link,
    })
    .eq("id", settingsId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export async function createCompanyVehicle(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const plate_number = String(formData.get("plate_number") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) {
    throw new Error("Name is required.");
  }

  const { error } = await supabase.from("company_vehicles").insert({ name, plate_number, notes });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export async function deleteCompanyVehicle(vehicleId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("company_vehicles").delete().eq("id", vehicleId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export async function createShopHoliday(formData: FormData) {
  const supabase = await createClient();

  const holiday_date = String(formData.get("holiday_date") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();

  if (!holiday_date || !label) {
    throw new Error("Date and label are required.");
  }

  const { error } = await supabase.from("shop_holidays").insert({ holiday_date, label });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export async function deleteShopHoliday(holidayId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("shop_holidays").delete().eq("id", holidayId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}
