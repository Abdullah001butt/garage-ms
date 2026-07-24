import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyHeaderRow, applyBodyRow, applyTotalRow, CURRENCY_FORMAT, xlsxResponse } from "@/lib/xlsx-style";

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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet(`Summary ${month}`, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Day", key: "day", width: 10 },
    { header: "Cash In", key: "in", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Cash Out", key: "out", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Net", key: "net", width: 16, style: { numFmt: CURRENCY_FORMAT } },
  ];
  applyHeaderRow(sheet.getRow(1));

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

    const row = sheet.addRow({ day, in: dayIn, out: dayOut, net: dayIn - dayOut });
    applyBodyRow(row, day - 1);
    if (dayIn - dayOut < 0) {
      row.getCell("net").font = { color: { argb: "FFDC2626" }, bold: true };
    }
  }

  const totalRow = sheet.addRow({ day: "Total", in: totalIn, out: totalOut, net: totalIn - totalOut });
  applyTotalRow(totalRow);

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, `summary-${month}.xlsx`);
}
