import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const supabase = await createClient();

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, paid_at")
    .gte("paid_at", `${month}-01T00:00:00`)
    .lte("paid_at", `${month}-${String(daysInMonth).padStart(2, "0")}T23:59:59`);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, expense_date")
    .gte("expense_date", `${month}-01`)
    .lte("expense_date", `${month}-${String(daysInMonth).padStart(2, "0")}`);

  const lines = ["Day,Cash In,Cash Out,Net"];
  let totalIn = 0;
  let totalOut = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${month}-${String(day).padStart(2, "0")}`;
    const dayIn = (payments ?? [])
      .filter((p) => p.paid_at.slice(0, 10) === dateStr)
      .reduce((s, p) => s + Number(p.amount), 0);
    const dayOut = (expenses ?? [])
      .filter((e) => e.expense_date === dateStr)
      .reduce((s, e) => s + Number(e.amount), 0);
    totalIn += dayIn;
    totalOut += dayOut;
    lines.push(`${day},${dayIn.toFixed(2)},${dayOut.toFixed(2)},${(dayIn - dayOut).toFixed(2)}`);
  }

  lines.push(`Total,${totalIn.toFixed(2)},${totalOut.toFixed(2)},${(totalIn - totalOut).toFixed(2)}`);

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="summary-${month}.csv"`,
    },
  });
}
