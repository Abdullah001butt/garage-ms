import { createClient } from "@/lib/supabase/server";

export type ServiceDueVehicle = {
  vehicleId: string;
  plateNumber: string;
  make: string | null;
  model: string | null;
  customerName: string;
  customerPhone: string;
  lastServiceAt: Date;
  dueAt: Date;
  status: "overdue" | "due_soon";
};

const DUE_SOON_WINDOW_DAYS = 14;

export async function getServiceDueVehicles(): Promise<ServiceDueVehicle[]> {
  const supabase = await createClient();

  const [{ data: settings }, { data: vehicles }, { data: jobs }] = await Promise.all([
    supabase.from("shop_settings").select("default_service_interval_days").maybeSingle(),
    supabase
      .from("vehicles")
      .select("id, plate_number, make, model, service_interval_days, customers(name, phone)")
      .returns<
        {
          id: string;
          plate_number: string;
          make: string | null;
          model: string | null;
          service_interval_days: number | null;
          customers: { name: string; phone: string } | null;
        }[]
      >(),
    supabase
      .from("job_cards")
      .select("vehicle_id, completed_at")
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .returns<{ vehicle_id: string; completed_at: string }[]>(),
  ]);

  const defaultInterval = settings?.default_service_interval_days ?? 90;

  const lastServiceMap = new Map<string, Date>();
  for (const job of jobs ?? []) {
    if (!lastServiceMap.has(job.vehicle_id)) {
      lastServiceMap.set(job.vehicle_id, new Date(job.completed_at));
    }
  }

  const now = Date.now();
  const dueSoonCutoff = now + DUE_SOON_WINDOW_DAYS * 86400000;
  const results: ServiceDueVehicle[] = [];

  for (const v of vehicles ?? []) {
    const lastServiceAt = lastServiceMap.get(v.id);
    if (!lastServiceAt || !v.customers) continue;

    const interval = v.service_interval_days ?? defaultInterval;
    const dueAt = new Date(lastServiceAt.getTime() + interval * 86400000);

    if (dueAt.getTime() <= dueSoonCutoff) {
      results.push({
        vehicleId: v.id,
        plateNumber: v.plate_number,
        make: v.make,
        model: v.model,
        customerName: v.customers.name,
        customerPhone: v.customers.phone,
        lastServiceAt,
        dueAt,
        status: dueAt.getTime() < now ? "overdue" : "due_soon",
      });
    }
  }

  return results.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
