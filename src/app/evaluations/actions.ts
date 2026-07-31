"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { DiagramMarker, InspectionCondition, InspectionItem } from "@/lib/types";

function parseInspectionItems(formData: FormData): InspectionItem[] {
  const particulars = formData.getAll("inspection_particular") as string[];
  const remarks = formData.getAll("inspection_remarks") as string[];

  return particulars.map((particular, i) => ({
    particular,
    condition: (String(formData.get(`inspection_condition_${i}`) ?? "na")) as InspectionCondition,
    remarks: (remarks[i] || "").trim(),
  }));
}

function parseDiagramMarkers(formData: FormData): DiagramMarker[] {
  const raw = String(formData.get("diagram_markers") ?? "[]");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => typeof m?.x === "number" && typeof m?.y === "number")
      .map((m) => ({ x: m.x, y: m.y, note: String(m.note ?? "").trim() }));
  } catch {
    return [];
  }
}

function str(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim() || null;
}

export async function createVehicleEvaluation(formData: FormData) {
  const supabase = await createClient();

  const customer_name = String(formData.get("customer_name") ?? "").trim();
  const make_model = String(formData.get("make_model") ?? "").trim();

  if (!customer_name || !make_model) {
    throw new Error("Customer name and Make/Model are required.");
  }

  const evaluation_date = str(formData, "evaluation_date") ?? new Date().toISOString().slice(0, 10);
  const min = str(formData, "estimated_value_min");
  const max = str(formData, "estimated_value_max");
  const fee = str(formData, "fee_amount");

  const payload = {
    evaluation_date,
    customer_name,
    customer_location: str(formData, "customer_location"),
    customer_phone: str(formData, "customer_phone"),
    customer_ref: str(formData, "customer_ref"),
    make_model,
    registration_no: str(formData, "registration_no"),
    year_of_manufacture: str(formData, "year_of_manufacture"),
    color: str(formData, "color"),
    mileage_odo: str(formData, "mileage_odo"),
    chassis_no: str(formData, "chassis_no"),
    ownership: str(formData, "ownership"),
    engine_no: str(formData, "engine_no"),
    date_of_last_service: str(formData, "date_of_last_service"),
    type_of_vehicle: str(formData, "type_of_vehicle"),
    accident_history: str(formData, "accident_history"),
    no_of_doors: str(formData, "no_of_doors"),
    no_of_cylinders: str(formData, "no_of_cylinders"),
    service_history: str(formData, "service_history"),
    warranty_remaining: str(formData, "warranty_remaining"),
    transmission: str(formData, "transmission"),
    empty_weight: str(formData, "empty_weight"),
    specification_origin: str(formData, "specification_origin"),
    gross_weight: str(formData, "gross_weight"),
    remote: str(formData, "remote"),
    inspection_items: parseInspectionItems(formData),
    diagram_markers: parseDiagramMarkers(formData),
    estimated_value_min: min ? Number(min) : null,
    estimated_value_max: max ? Number(max) : null,
    valuator_name: str(formData, "valuator_name"),
    fee_amount: fee ? Number(fee) : null,
  };

  const { data, error } = await supabase.from("vehicle_evaluations").insert(payload).select().single();

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle_evaluation.create", "vehicle_evaluation", data.id, {
    ref_number: data.ref_number,
    customer_name,
  });

  revalidatePath("/evaluations");
  redirect(`/evaluations/${data.id}`);
}

export async function deleteVehicleEvaluation(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("vehicle_evaluations").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("vehicle_evaluation.delete", "vehicle_evaluation", id);

  revalidatePath("/evaluations");
}
