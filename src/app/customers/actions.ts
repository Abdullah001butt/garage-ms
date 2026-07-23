"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
