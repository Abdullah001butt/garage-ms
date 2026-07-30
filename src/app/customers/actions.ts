"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isValidPlateNumber, normalizePlateNumber } from "@/lib/plate";

export async function createCustomerWithVehicle(formData: FormData) {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;

  const plateRaw = String(formData.get("plate_number") ?? "").trim();
  const emirate = String(formData.get("emirate") ?? "Ajman").trim();
  const make = String(formData.get("make") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const color = String(formData.get("color") ?? "").trim() || null;

  if (!name || !phone) {
    throw new Error("Name and phone are required.");
  }

  if (plateRaw && !isValidPlateNumber(plateRaw)) {
    throw new Error("Plate number must be a valid UAE format, e.g. \"A 12345\" or \"12 4567\".");
  }
  const plate_number = plateRaw ? normalizePlateNumber(plateRaw) : "";

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
      emirate,
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

  const plateRaw = String(formData.get("plate_number") ?? "").trim();
  const emirate = String(formData.get("emirate") ?? "Ajman").trim();
  const make = String(formData.get("make") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const vin = String(formData.get("vin") ?? "").trim() || null;

  if (!plateRaw) {
    throw new Error("Plate number is required.");
  }
  if (!isValidPlateNumber(plateRaw)) {
    throw new Error("Plate number must be a valid UAE format, e.g. \"A 12345\" or \"12 4567\".");
  }
  const plate_number = normalizePlateNumber(plateRaw);

  const { error } = await supabase
    .from("vehicles")
    .update({ plate_number, emirate, make, model, year, color, vin })
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

export async function addBalanceAdjustment(customerId: string, formData: FormData) {
  const supabase = await createClient();

  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (!amount || !note) {
    throw new Error("Amount and note are required.");
  }

  const { error } = await supabase.from("customer_balance_adjustments").insert({
    customer_id: customerId,
    amount,
    note,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("customer.balance_adjustment", "customer", customerId, { amount, note });

  revalidatePath(`/customers/${customerId}`);
}

export async function deleteBalanceAdjustment(customerId: string, adjustmentId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("customer_balance_adjustments")
    .delete()
    .eq("id", adjustmentId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("customer.balance_adjustment_delete", "customer", customerId);

  revalidatePath(`/customers/${customerId}`);
}

export async function addVehicle(customerId: string, formData: FormData) {
  const supabase = await createClient();

  const plateRaw = String(formData.get("plate_number") ?? "").trim();
  const emirate = String(formData.get("emirate") ?? "Ajman").trim();
  const make = String(formData.get("make") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const vin = String(formData.get("vin") ?? "").trim() || null;

  if (!plateRaw) {
    throw new Error("Plate number is required.");
  }
  if (!isValidPlateNumber(plateRaw)) {
    throw new Error("Plate number must be a valid UAE format, e.g. \"A 12345\" or \"12 4567\".");
  }
  const plate_number = normalizePlateNumber(plateRaw);

  const { error } = await supabase.from("vehicles").insert({
    customer_id: customerId,
    plate_number,
    emirate,
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
