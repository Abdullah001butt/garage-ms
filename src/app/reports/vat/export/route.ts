import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InvoiceRow = {
  id: string;
  created_at: string;
  vat_rate: number;
  customers: { name: string } | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, created_at, vat_rate, customers(name), invoice_items(quantity, unit_price)")
    .eq("document_type", "invoice")
    .gte("created_at", start)
    .lte("created_at", `${end}T23:59:59`)
    .order("created_at")
    .returns<InvoiceRow[]>();

  const rows = (invoices ?? []).map((inv) => {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const vat = subtotal * (inv.vat_rate / 100);
    return {
      date: new Date(inv.created_at).toISOString().slice(0, 10),
      customer: inv.customers?.name ?? "",
      net: subtotal.toFixed(2),
      vat: vat.toFixed(2),
      total: (subtotal + vat).toFixed(2),
    };
  });

  const header = "Date,Customer,Net,VAT,Total";
  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.date, csvEscape(r.customer), r.net, r.vat, r.total].join(",")
  );
  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="vat-report-${start}-to-${end}.csv"`,
    },
  });
}
