import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CustomerResult = { type: "customer"; id: string; title: string; subtitle: string };
type VehicleResult = { type: "vehicle"; id: string; customerId: string; title: string; subtitle: string };
type JobResult = { type: "job"; id: string; title: string; subtitle: string };

export type SearchResult = CustomerResult | VehicleResult | JobResult;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createClient();
  const like = `%${q}%`;

  const [{ data: customers }, { data: vehicles }, { data: jobs }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone")
      .or(`name.ilike.${like},phone.ilike.${like}`)
      .limit(6),
    supabase
      .from("vehicles")
      .select("id, customer_id, plate_number, make, model, customers(name)")
      .ilike("plate_number", like)
      .limit(6)
      .returns<
        {
          id: string;
          customer_id: string;
          plate_number: string;
          make: string | null;
          model: string | null;
          customers: { name: string } | null;
        }[]
      >(),
    supabase
      .from("job_cards")
      .select("id, description, status, vehicles(plate_number), customers(name)")
      .ilike("description", like)
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<
        {
          id: string;
          description: string;
          status: string;
          vehicles: { plate_number: string } | null;
          customers: { name: string } | null;
        }[]
      >(),
  ]);

  const results: SearchResult[] = [
    ...(customers ?? []).map((c) => ({
      type: "customer" as const,
      id: c.id,
      title: c.name,
      subtitle: c.phone,
    })),
    ...(vehicles ?? []).map((v) => ({
      type: "vehicle" as const,
      id: v.id,
      customerId: v.customer_id,
      title: v.plate_number,
      subtitle: `${[v.make, v.model].filter(Boolean).join(" ")}${v.customers?.name ? ` · ${v.customers.name}` : ""}`,
    })),
    ...(jobs ?? []).map((j) => ({
      type: "job" as const,
      id: j.id,
      title: j.description,
      subtitle: `${j.vehicles?.plate_number ?? ""}${j.customers?.name ? ` · ${j.customers.name}` : ""} · ${j.status.replace("_", " ")}`,
    })),
  ];

  return NextResponse.json({ results });
}
