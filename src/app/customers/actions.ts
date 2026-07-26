"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function createCustomerWithVehicle(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;

  const plate_number = String(formData.get("plate_number") ?? "").trim();
  const make = String(formData.get("make") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const color = String(formData.get("color") ?? "").trim() || null;

  if (!name || !phone) {
    throw new Error("Name and phone are required.");
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({ name, phone, email, address })
    .select()
    .single();

  if (customerError) {
    throw new Error(customerError.message);
  }

  if (plate_number) {
    const { error: vehicleError } = await supabase.from("vehicles").insert({
      customer_id: customer.id,
      plate_number,
      make,
      model,
      year,
      color,
    });

    if (vehicleError) {
      throw new Error(vehicleError.message);
    }
  }

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!name || !phone) {
    throw new Error("Name and phone are required.");
  }

  const { error } = await supabase
    .from("customers")
    .update({ name, phone, email, address })
    .eq("id", customerId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("customer.update", "customer", customerId, { name, phone });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

export async function deleteCustomer(customerId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("customers").delete().eq("id", customerId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("customer.delete", "customer", customerId);

  revalidatePath("/customers");
}

export async function updateVehicle(customerId: string, vehicleId: string, formData: FormData) {
  const supabase = await createClient();

  const plate_number = String(formData.get("plate_number") ?? "").trim();
  const make = String(formData.get("make") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const vin = String(formData.get("vin") ?? "").trim() || null;

  if (!plate_number) {
    throw new Error("Plate number is required.");
  }

  const { error } = await supabase
    .from("vehicles")
    .update({ plate_number, make, model, year, color, vin })
    .eq("id", vehicleId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle.update", "vehicle", vehicleId, { plate_number });

  revalidatePath(`/customers/${customerId}`);
}

export async function deleteVehicle(customerId: string, vehicleId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("vehicles").delete().eq("id", vehicleId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle.delete", "vehicle", vehicleId);

  revalidatePath(`/customers/${customerId}`);
}

export async function addVehicle(customerId: string, formData: FormData) {
  const supabase = await createClient();

  const plate_number = String(formData.get("plate_number") ?? "").trim();
  const make = String(formData.get("make") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const vin = String(formData.get("vin") ?? "").trim() || null;

  if (!plate_number) {
    throw new Error("Plate number is required.");
  }

  const { error } = await supabase.from("vehicles").insert({
    customer_id: customerId,
    plate_number,
    make,
    model,
    year,
    color,
    vin,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/customers/${customerId}`);
}

export async function updateVehicleServiceInterval(
  customerId: string,
  vehicleId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const raw = String(formData.get("service_interval_days") ?? "").trim();
  const service_interval_days = raw ? Number(raw) : null;

  const { error } = await supabase
    .from("vehicles")
    .update({ service_interval_days })
    .eq("id", vehicleId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/customers/${customerId}`);
}
