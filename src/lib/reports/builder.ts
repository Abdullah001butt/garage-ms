import type { SupabaseClient } from "@supabase/supabase-js";

export type BuilderFilters = {
  from?: string;
  to?: string;
  customerId?: string;
  itemType?: string;
  mechanic?: string;
};

export type BuilderRow = {
  invoice_id: string;
  invoice_date: string;
  customer_name: string;
  vehicle: string;
  mechanic_name: string | null;
  description: string;
  item_type: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type RawItem = {
  invoice_id: string;
  description: string;
  item_type: string;
  quantity: number;
  unit_price: number;
  invoices: {
    created_at: string;
    document_type: string;
    customers: { name: string } | null;
    job_cards: {
      mechanic_name: string | null;
      vehicles: { plate_number: string; make: string | null; model: string | null } | null;
    } | null;
  } | null;
};

export async function fetchBuilderRows(supabase: SupabaseClient, filters: BuilderFilters): Promise<BuilderRow[]> {
  const fromDate = filters.from || "2000-01-01";
  const toDate = filters.to || new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("invoice_items")
    .select(
      `invoice_id, description, item_type, quantity, unit_price,
       invoices!inner(created_at, document_type, customer_id,
         customers(name),
         job_cards(mechanic_name, vehicles(plate_number, make, model))
       )`
    )
    .eq("invoices.document_type", "invoice")
    .gte("invoices.created_at", fromDate)
    .lte("invoices.created_at", `${toDate}T23:59:59`);

  if (filters.customerId) {
    query = query.eq("invoices.customer_id", filters.customerId);
  }
  if (filters.itemType) {
    query = query.eq("item_type", filters.itemType);
  }

  const { data } = await query.returns<RawItem[]>();

  const rows: BuilderRow[] = (data ?? [])
    .filter((item) => item.invoices)
    .map((item) => {
      const inv = item.invoices!;
      const vehicle = inv.job_cards?.vehicles;
      return {
        invoice_id: item.invoice_id,
        invoice_date: inv.created_at,
        customer_name: inv.customers?.name ?? "Unknown",
        vehicle: vehicle ? [vehicle.plate_number, vehicle.make, vehicle.model].filter(Boolean).join(" · ") : "—",
        mechanic_name: inv.job_cards?.mechanic_name ?? null,
        description: item.description,
        item_type: item.item_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.quantity * item.unit_price,
      };
    })
    .filter((r) => !filters.mechanic || r.mechanic_name === filters.mechanic);

  return rows.sort((a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime());
}
