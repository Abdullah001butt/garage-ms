import { createClient } from "@/lib/supabase/server";

export type ActiveWarranty = {
  description: string;
  until: Date;
};

type WarrantyItemRow = {
  description: string;
  warranty_days: number | null;
  invoices: {
    created_at: string;
    document_type: string;
    job_cards: { vehicle_id: string } | null;
  } | null;
};

export async function getActiveWarrantiesForVehicle(vehicleId: string): Promise<ActiveWarranty[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("invoice_items")
    .select("description, warranty_days, invoices(created_at, document_type, job_cards(vehicle_id))")
    .not("warranty_days", "is", null)
    .returns<WarrantyItemRow[]>();

  const now = Date.now();

  return (data ?? [])
    .filter(
      (row) =>
        row.invoices?.document_type === "invoice" &&
        row.invoices.job_cards?.vehicle_id === vehicleId
    )
    .map((row) => ({
      description: row.description,
      until: new Date(new Date(row.invoices!.created_at).getTime() + row.warranty_days! * 86400000),
    }))
    .filter((w) => w.until.getTime() > now)
    .sort((a, b) => a.until.getTime() - b.until.getTime());
}

export async function getActiveWarrantiesForVehicles(
  vehicleIds: string[]
): Promise<Map<string, ActiveWarranty[]>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("invoice_items")
    .select("description, warranty_days, invoices(created_at, document_type, job_cards(vehicle_id))")
    .not("warranty_days", "is", null)
    .returns<WarrantyItemRow[]>();

  const now = Date.now();
  const map = new Map<string, ActiveWarranty[]>();

  for (const row of data ?? []) {
    const vehicleId = row.invoices?.job_cards?.vehicle_id;
    if (!vehicleId || row.invoices?.document_type !== "invoice" || !vehicleIds.includes(vehicleId)) {
      continue;
    }
    const until = new Date(new Date(row.invoices!.created_at).getTime() + row.warranty_days! * 86400000);
    if (until.getTime() <= now) continue;

    const list = map.get(vehicleId) ?? [];
    list.push({ description: row.description, until });
    map.set(vehicleId, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.until.getTime() - b.until.getTime());
  }

  return map;
}
