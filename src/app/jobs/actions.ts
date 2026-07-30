"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { JobStatus } from "@/lib/types";

export async function createJobCard(formData: FormData) {
  const supabase = await createClient();

  const vehicleCustomer = String(formData.get("vehicle_customer") ?? "").trim();
  const [vehicle_id, customer_id] = vehicleCustomer.split("::");
  const description = String(formData.get("description") ?? "").trim();
  const mechanic_name = String(formData.get("mechanic_name") ?? "").trim() || null;
  const odometerRaw = String(formData.get("odometer") ?? "").trim();
  const odometer = odometerRaw ? Number(odometerRaw) : null;

  if (!vehicle_id || !customer_id || !description) {
    throw new Error("Vehicle and description are required.");
  }

  const { data: jobCard, error } = await supabase
    .from("job_cards")
    .insert({ vehicle_id, customer_id, description, mechanic_name, odometer })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/jobs");
  redirect(`/jobs/${jobCard.id}`);
}

export async function updateJobCard(jobId: string, formData: FormData) {
  const supabase = await createClient();

  const description = String(formData.get("description") ?? "").trim();
  const mechanic_name = String(formData.get("mechanic_name") ?? "").trim() || null;
  const odometerRaw = String(formData.get("odometer") ?? "").trim();
  const odometer = odometerRaw ? Number(odometerRaw) : null;

  if (!description) {
    throw new Error("Description is required.");
  }

  const { error } = await supabase
    .from("job_cards")
    .update({ description, mechanic_name, odometer })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("job.update", "job_card", jobId, { description, mechanic_name });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export async function deleteJobCard(jobId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("job_cards").delete().eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("job.delete", "job_card", jobId);

  revalidatePath("/jobs");
}

export async function addJobSublet(jobId: string, formData: FormData) {
  const supabase = await createClient();

  const vendor_name = String(formData.get("vendor_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const cost = Number(formData.get("cost") ?? 0);

  if (!vendor_name || !description || !cost) {
    throw new Error("Vendor, description, and cost are required.");
  }

  const { error } = await supabase.from("job_sublets").insert({
    job_card_id: jobId,
    vendor_name,
    description,
    cost,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("job.sublet_add", "job_card", jobId, { vendor_name, cost });

  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteJobSublet(jobId: string, subletId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("job_sublets").delete().eq("id", subletId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("job.sublet_delete", "job_card", jobId);

  revalidatePath(`/jobs/${jobId}`);
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("job_cards")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("job.status_change", "job_card", jobId, { new_status: status });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}
