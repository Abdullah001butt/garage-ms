"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { isValidPlateNumber, normalizePlateNumber } from "@/lib/plate";
import type { CustomerType } from "@/lib/types";

function parseCustomerFields(formData: FormData) {
  const customer_type = (String(formData.get("customer_type") ?? "individual").trim() || "individual") as CustomerType;
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const landline = String(formData.get("landline") ?? "").trim() || null;
  const trn_number = String(formData.get("trn_number") ?? "").trim() || null;
  const representative = String(formData.get("representative") ?? "").trim() || null;
  const reference_name = String(formData.get("reference_name") ?? "").trim() || null;

  if (!name || !phone) {
    throw new Error("Name and Mobile No are required.");
  }

  return {
    customer_type,
    name,
    phone,
    email: customer_type === "company" ? null : email,
    address,
    city,
    landline,
    trn_number,
    representative: customer_type === "company" ? representative : null,
    reference_name,
  };
}

function combinedPlateRaw(formData: FormData) {
  const code = String(formData.get("plate_code") ?? "").trim();
  const digits = String(formData.get("plate_digits") ?? "").trim();
  return `${code} ${digits}`.trim();
}

function parseVehicleFields(formData: FormData) {
  const plateRaw = combinedPlateRaw(formData);
  if (!isValidPlateNumber(plateRaw)) {
    throw new Error('Plate number must be a valid UAE format, e.g. "A 12345" or "12 4567".');
  }

  const emirate = String(formData.get("emirate") ?? "Ajman").trim();
  const registrationExpiryRaw = String(formData.get("registration_expiry_date") ?? "").trim();
  const make = String(formData.get("make") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const yearRaw = String(formData.get("year") ?? "").trim();
  const origin_trim = String(formData.get("origin_trim") ?? "").trim() || null;
  const vin = String(formData.get("vin") ?? "").trim() || null;
  const body_type = String(formData.get("body_type") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const cylindersRaw = String(formData.get("cylinders") ?? "").trim();
  const currentMileageRaw = String(formData.get("current_mileage") ?? "").trim();
  const odometerRaw = String(formData.get("odometer_reading") ?? "").trim();

  return {
    plate_number: normalizePlateNumber(plateRaw),
    emirate,
    registration_expiry_date: registrationExpiryRaw || null,
    make,
    model,
    year: yearRaw ? Number(yearRaw) : null,
    origin_trim,
    vin,
    body_type,
    color,
    cylinders: cylindersRaw ? Number(cylindersRaw) : null,
    current_mileage: currentMileageRaw ? Number(currentMileageRaw) : null,
    odometer_reading: odometerRaw ? Number(odometerRaw) : null,
  };
}

export async function createCustomerWithVehicle(formData: FormData) {
  const supabase = await createClient();

  const customerFields = parseCustomerFields(formData);

  const plateRaw = combinedPlateRaw(formData);

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert(customerFields)
    .select()
    .single();

  if (customerError) {
    throw new Error(customerError.message);
  }

  if (plateRaw) {
    const vehicleFields = parseVehicleFields(formData);
    const { error: vehicleError } = await supabase.from("vehicles").insert({
      customer_id: customer.id,
      ...vehicleFields,
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

  const customerFields = parseCustomerFields(formData);

  const { error } = await supabase.from("customers").update(customerFields).eq("id", customerId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("customer.update", "customer", customerId, { name: customerFields.name, phone: customerFields.phone });

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

  const vehicleFields = parseVehicleFields(formData);

  const { error } = await supabase.from("vehicles").update(vehicleFields).eq("id", vehicleId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle.update", "vehicle", vehicleId, { plate_number: vehicleFields.plate_number });

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

  const vehicleFields = parseVehicleFields(formData);

  const { error } = await supabase.from("vehicles").insert({
    customer_id: customerId,
    ...vehicleFields,
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
