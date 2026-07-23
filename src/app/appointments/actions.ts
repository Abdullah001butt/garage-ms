"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/types";

export async function createAppointment(formData: FormData) {
  const supabase = await createClient();

  const customerVehicle = String(formData.get("customer_vehicle") ?? "").trim();
  const [customer_id, vehicle_id] = customerVehicle.split("::");
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!customer_id || !date || !time) {
    throw new Error("Customer, date, and time are required.");
  }

  const scheduled_at = new Date(`${date}T${time}`).toISOString();

  const { error } = await supabase.from("appointments").insert({
    customer_id,
    vehicle_id: vehicle_id || null,
    scheduled_at,
    notes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/appointments");
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/appointments");
}
