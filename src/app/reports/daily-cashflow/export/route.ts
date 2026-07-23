import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PaymentRow = {
  amount: number;
  invoices: {
    customers: { name: string } | null;
    job_cards: {
      description: string;
      vehicles: { plate_number: string } | null;
    } | null;
  } | null;
};

type ExpenseRow = {
  category: string;
  description: string | null;
  amount: number;
};

function csvEscape(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, invoices(customers(name), job_cards(description, vehicles(plate_number)))")
    .gte("paid_at", `${date}T00:00:00`)
    .lte("paid_at", `${date}T23:59:59`)
    .returns<PaymentRow[]>();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("category, description, amount")
    .eq("expense_date", date)
    .returns<ExpenseRow[]>();

  const inRows = (payments ?? []).map((p) => [
    csvEscape(p.invoices?.job_cards?.vehicles?.plate_number ?? p.invoices?.customers?.name ?? ""),
    csvEscape(p.invoices?.job_cards?.description ?? ""),
    Number(p.amount).toFixed(2),
  ]);
  const outRows = (expenses ?? []).map((e) => [
    csvEscape(e.category),
    csvEscape(e.description ?? ""),
    Number(e.amount).toFixed(2),
  ]);

  const totalIn = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalOut = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const maxLen = Math.max(inRows.length, outRows.length);
  const lines = ["Vehicle/Customer,Job In,Amount In,Category,Description,Amount Out"];
  for (let i = 0; i < maxLen; i++) {
    const inRow = inRows[i] ?? ["", "", ""];
    const outRow = outRows[i] ?? ["", "", ""];
    lines.push([...inRow, ...outRow].join(","));
  }
  lines.push("");
  lines.push(`,,${totalIn.toFixed(2)},,,${totalOut.toFixed(2)}`);
  lines.push(`,,,,,Net: ${(totalIn - totalOut).toFixed(2)}`);

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cashflow-${date}.csv"`,
    },
  });
}
