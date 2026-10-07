import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatInvoiceNumber } from "@/lib/invoice-number";

type CustomerResult = { type: "customer"; id: string; title: string; subtitle: string };
type VehicleResult = { type: "vehicle"; id: string; customerId: string; title: string; subtitle: string };
type JobResult = { type: "job"; id: string; title: string; subtitle: string };
type InvoiceResult = { type: "invoice" | "estimate"; id: string; title: string; subtitle: string };
type PartResult = { type: "part"; id: string; title: string; subtitle: string };
type SupplierResult = { type: "supplier"; id: string; title: string; subtitle: string };

export type SearchResult = CustomerResult | VehicleResult | JobResult | InvoiceResult | PartResult | SupplierResult;

const money = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const like = `%${q}%`;
  const digits = q.replace(/\D/g, "");
  // "0567549898" also finds "056-754 9898": every digit may have separators between.
  const phoneLike = digits.length >= 5 ? `%${digits.split("").join("%")}%` : null;
  // INV-2026-0013, 2026-13, #13 or plain 13 → invoice number 13.
  const invoiceNo = /^(inv)?[-\s#]*(\d{4}[-\s])?0*(\d{1,6})$/i.exec(q.replace(/\s+/g, " "))?.[3];

  const customerFilter = phoneLike ? `name.ilike.${like},phone.ilike.${phoneLike},landline.ilike.${phoneLike}` : `name.ilike.${like},phone.ilike.${like}`;

  const [{ data: customers }, { data: vehicles }, { data: jobs }, { data: parts }, { data: suppliers }, { data: byNumber }] = await Promise.all([
    supabase.from("customers").select("id, name, phone").or(customerFilter).limit(12),
    supabase
      .from("vehicles")
      .select("id, customer_id, plate_number, make, model, vin, customers(name)")
      .or(`plate_number.ilike.${like},vin.ilike.${like}`)
      .limit(6)
      .returns<{ id: string; customer_id: string; plate_number: string; make: string | null; model: string | null; customers: { name: string } | null }[]>(),
    supabase
      .from("job_cards")
      .select("id, description, status, vehicles(plate_number), customers(name)")
      .ilike("description", like)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<{ id: string; description: string; status: string; vehicles: { plate_number: string } | null; customers: { name: string } | null }[]>(),
    supabase.from("parts").select("id, name, sku, stock_qty").or(`name.ilike.${like},sku.ilike.${like}`).limit(5),
    supabase.from("suppliers").select("id, name, phone").or(phoneLike ? `name.ilike.${like},phone.ilike.${phoneLike}` : `name.ilike.${like}`).limit(4),
    invoiceNo
      ? supabase
          .from("invoices")
          .select("id, document_type, invoice_number, created_at, status, customers(name)")
          .eq("invoice_number", Number(invoiceNo))
          .limit(3)
          .returns<{ id: string; document_type: string; invoice_number: number | null; created_at: string; status: string; customers: { name: string } | null }[]>()
      : Promise.resolve({ data: [] as { id: string; document_type: string; invoice_number: number | null; created_at: string; status: string; customers: { name: string } | null }[] }),
  ]);

  // Invoices for matching customers (search by name or phone finds their bills too).
  const customerIds = (customers ?? []).map((c) => c.id);
  const { data: customerInvoices } = customerIds.length
    ? await supabase
        .from("invoices")
        .select("id, document_type, invoice_number, created_at, status, vat_rate, discount, customers(name), invoice_items(quantity, unit_price)")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false })
        .limit(6)
        .returns<
          {
            id: string;
            document_type: string;
            invoice_number: number | null;
            created_at: string;
            status: string;
            vat_rate: number;
            discount: number;
            customers: { name: string } | null;
            invoice_items: { quantity: number; unit_price: number }[];
          }[]
        >()
    : { data: [] };

  const seen = new Set<string>();
  const invoiceResults: InvoiceResult[] = [...(byNumber ?? []), ...(customerInvoices ?? [])]
    .filter((inv) => (seen.has(inv.id) ? false : (seen.add(inv.id), true)))
    .slice(0, 6)
    .map((inv) => {
      const isEstimate = inv.document_type === "estimate";
      const items = "invoice_items" in inv ? (inv as { invoice_items: { quantity: number; unit_price: number }[] }).invoice_items : null;
      const amount = items
        ? items.reduce((s, it) => s + it.quantity * it.unit_price, 0) * (1 + Number((inv as { vat_rate?: number }).vat_rate ?? 5) / 100) - Number((inv as { discount?: number }).discount ?? 0)
        : null;
      return {
        type: isEstimate ? ("estimate" as const) : ("invoice" as const),
        id: inv.id,
        title: isEstimate ? `Estimate · ${inv.customers?.name ?? ""}` : formatInvoiceNumber(inv.invoice_number, inv.created_at) ?? "Invoice",
        subtitle: [inv.customers?.name, isEstimate ? null : inv.status, amount !== null ? money(amount) : null].filter(Boolean).join(" · "),
      };
    });

  const results: SearchResult[] = [
    ...invoiceResults.filter((r) => byNumber?.some((b) => b.id === r.id)),
    ...(customers ?? []).slice(0, 6).map((c) => ({ type: "customer" as const, id: c.id, title: c.name, subtitle: c.phone })),
    ...(vehicles ?? []).map((v) => ({
      type: "vehicle" as const,
      id: v.id,
      customerId: v.customer_id,
      title: v.plate_number,
      subtitle: `${[v.make, v.model].filter(Boolean).join(" ")}${v.customers?.name ? ` · ${v.customers.name}` : ""}`,
    })),
    ...invoiceResults.filter((r) => !byNumber?.some((b) => b.id === r.id)),
    ...(jobs ?? []).map((j) => ({
      type: "job" as const,
      id: j.id,
      title: j.description,
      subtitle: `${j.vehicles?.plate_number ?? ""}${j.customers?.name ? ` · ${j.customers.name}` : ""} · ${j.status.replace("_", " ")}`,
    })),
    ...(parts ?? []).map((p) => ({ type: "part" as const, id: p.id, title: p.name, subtitle: `${p.sku ? `${p.sku} · ` : ""}${p.stock_qty} in stock` })),
    ...(suppliers ?? []).map((s) => ({ type: "supplier" as const, id: s.id, title: s.name, subtitle: s.phone ?? "Supplier" })),
  ];

  return NextResponse.json({ results });
}
