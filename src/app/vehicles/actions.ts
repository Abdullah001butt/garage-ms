"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function transferVehicleOwnership(vehicleId: string, formData: FormData) {
  const supabase = await createClient();

  const new_customer_id = String(formData.get("new_customer_id") ?? "").trim();
  if (!new_customer_id) {
    throw new Error("Select a customer to transfer to.");
  }

  const { error } = await supabase
    .from("vehicles")
    .update({ customer_id: new_customer_id })
    .eq("id", vehicleId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle.transfer_ownership", "vehicle", vehicleId, { new_customer_id });

  revalidatePath(`/vehicles/${vehicleId}/passport`);
}

export async function addVehicleIncident(vehicleId: string, formData: FormData) {
  const supabase = await createClient();

  const incident_date = String(formData.get("incident_date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!incident_date || !description) {
    throw new Error("Date and description are required.");
  }

  const { error } = await supabase.from("vehicle_incidents").insert({
    vehicle_id: vehicleId,
    incident_date,
    description,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle.incident_add", "vehicle", vehicleId, { incident_date, description });

  revalidatePath(`/vehicles/${vehicleId}/passport`);
}

export async function deleteVehicleIncident(vehicleId: string, incidentId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("vehicle_incidents").delete().eq("id", incidentId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle.incident_delete", "vehicle", vehicleId);

  revalidatePath(`/vehicles/${vehicleId}/passport`);
}

export async function uploadVehicleDocument(vehicleId: string, formData: FormData) {
  const supabase = await createClient();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("Select a file to upload.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${vehicleId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("vehicle-files")
    .upload(filePath, file, { contentType: file.type });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error } = await supabase.from("vehicle_documents").insert({
    vehicle_id: vehicleId,
    file_name: file.name,
    file_path: filePath,
    file_type: file.type,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle.document_upload", "vehicle", vehicleId, { file_name: file.name });

  revalidatePath(`/vehicles/${vehicleId}/passport`);
}

export async function deleteVehicleDocument(vehicleId: string, documentId: string, filePath: string) {
  const supabase = await createClient();

  await supabase.storage.from("vehicle-files").remove([filePath]);

  const { error } = await supabase.from("vehicle_documents").delete().eq("id", documentId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle.document_delete", "vehicle", vehicleId);

  revalidatePath(`/vehicles/${vehicleId}/passport`);
}
