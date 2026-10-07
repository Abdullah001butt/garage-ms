import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isoBounds } from "@/lib/date-range";
import { formatInvoiceNumber } from "@/lib/invoice-number";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  invoices: { id: string; invoice_number: number | null; created_at: string; document_type: string; customers: { name: string } | null } | null;
};

/** The payments and expenses behind one bar of the dashboard chart (UAE days, inclusive). */
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || from > to) return NextResponse.json({ error: "Bad range" }, { status: 400 });

  const supabase = await createClient();
  const { start, end } = isoBounds(from, to);
  const [{ data: payments, error: pErr }, { data: expenses, error: eErr }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, invoices(id, invoice_number, created_at, document_type, customers(name))")
      .gte("paid_at", start)
      .lte("paid_at", end)
      .order("paid_at", { ascending: false })
      .returns<PaymentRow[]>(),
    supabase.from("expenses").select("id, category, description, amount, expense_date").gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: false }),
  ]);
  if (pErr || eErr) return NextResponse.json({ error: (pErr ?? eErr)?.message ?? "Could not load" }, { status: 500 });

  return NextResponse.json({
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      paid_at: p.paid_at,
      invoiceId: p.invoices?.id ?? null,
      invoiceNumber: p.invoices ? formatInvoiceNumber(p.invoices.invoice_number, p.invoices.created_at) : null,
      customer: p.invoices?.customers?.name ?? null,
    })),
    expenses: (expenses ?? []).map((e) => ({ id: e.id, amount: Number(e.amount), category: e.category, description: e.description, date: e.expense_date })),
  });
}
