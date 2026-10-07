import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatInvoiceNumber } from "@/lib/invoice-number";

type Item = { quantity: number; unit_price: number; item_type?: string; description?: string };

const subtotalOf = (items: Item[]) => items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);

/** Compact summary of a customer, invoice or job for the quick-preview side panel. */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const supabase = await createClient();

  if (type === "customer") {
    const [{ data: c }, { data: invoices }, { data: jobs }] = await Promise.all([
      supabase.from("customers").select("id, name, customer_type, phone, email, city, created_at, vehicles(id, plate_number, emirate, make, model, year)").eq("id", id).maybeSingle(),
      supabase
        .from("invoices")
        .select("id, invoice_number, created_at, status, vat_rate, discount, document_type, invoice_items(quantity, unit_price), payments(amount)")
        .eq("customer_id", id)
        .eq("document_type", "invoice")
        .order("created_at", { ascending: false }),
      supabase.from("job_cards").select("id, description, status, created_at").eq("customer_id", id).neq("status", "completed").order("created_at", { ascending: false }),
    ]);
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const rows = (invoices ?? []).map((inv) => {
      const sub = subtotalOf(inv.invoice_items as Item[]);
      const total = sub * (1 + Number(inv.vat_rate) / 100) - Number(inv.discount);
      const paid = ((inv.payments as { amount: number }[]) ?? []).reduce((s, p) => s + Number(p.amount), 0);
      return { id: inv.id, number: formatInvoiceNumber(inv.invoice_number, inv.created_at), created_at: inv.created_at, status: inv.status, total, balance: Math.max(total - paid, 0) };
    });
    return NextResponse.json({
      type,
      customer: c,
      lifetime: rows.reduce((s, r) => s + r.total, 0),
      balance: rows.reduce((s, r) => s + r.balance, 0),
      invoices: rows.slice(0, 5),
      invoiceCount: rows.length,
      openJobs: jobs ?? [],
    });
  }

  if (type === "invoice") {
    const { data: inv } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, created_at, status, vat_rate, discount, document_type, customers(id, name, phone), job_cards(id, description, vehicles(plate_number, emirate, make, model)), invoice_items(description, quantity, unit_price, item_type), payments(amount, method, paid_at)"
      )
      .eq("id", id)
      .maybeSingle();
    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const sub = subtotalOf(inv.invoice_items as Item[]);
    const vat = sub * (Number(inv.vat_rate) / 100);
    const total = sub + vat - Number(inv.discount);
    const paid = ((inv.payments as { amount: number }[]) ?? []).reduce((s, p) => s + Number(p.amount), 0);
    return NextResponse.json({
      type,
      invoice: { ...inv, number: formatInvoiceNumber(inv.invoice_number, inv.created_at) },
      subtotal: sub,
      vat,
      total,
      paid,
      balance: Math.max(total - paid, 0),
    });
  }

  if (type === "job") {
    const [{ data: job }, { data: invoice }] = await Promise.all([
      supabase
        .from("job_cards")
        .select("id, description, status, mechanic_name, odometer, created_at, completed_at, customers(id, name, phone), vehicles(id, plate_number, emirate, make, model, year)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("invoices").select("id, invoice_number, created_at, status").eq("job_card_id", id).maybeSingle(),
    ]);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      type,
      job,
      invoice: invoice ? { ...invoice, number: formatInvoiceNumber(invoice.invoice_number, invoice.created_at) } : null,
    });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
