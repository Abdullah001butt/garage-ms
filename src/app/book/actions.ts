"use server";

import { createClient } from "@/lib/supabase/server";

export async function bookAppointment(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const plate = String(formData.get("plate") ?? "").trim() || null;
  const make = String(formData.get("make") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !phone || !date || !time) {
    return { error: "Name, phone, date, and time are required." };
  }

  const scheduled_at = new Date(`${date}T${time}`).toISOString();

  const { error } = await supabase.rpc("public_book_appointment", {
    p_name: name,
    p_phone: phone,
    p_plate: plate,
    p_make: make,
    p_model: model,
    p_scheduled_at: scheduled_at,
    p_notes: notes,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
