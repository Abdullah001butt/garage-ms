import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { dayKey } from "@/lib/format";
import { isoBounds } from "@/lib/date-range";
import { currentMonth, isFriday, monthBounds, monthLabel } from "@/lib/salary";
import { applyBodyRow, applyTotalRow, startSheet, CURRENCY_FORMAT, DATE_FORMAT, XLSX_COLORS, xlsxResponse, type SheetColumn } from "@/lib/xlsx-style";

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("month");
  const month = param && /^\d{4}-\d{2}$/.test(param) ? param : currentMonth();
  const { start, end, days } = monthBounds(month);
  const bounds = isoBounds(start, end);

  const supabase = await createClient();
  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase.from("payments").select("amount, paid_at").gte("paid_at", bounds.start).lte("paid_at", bounds.end),
    supabase.from("expenses").select("amount, expense_date").gte("expense_date", start).lte("expense_date", end),
  ]);

  const columns: SheetColumn[] = [
    { header: "Date", key: "date", width: 14, numFmt: DATE_FORMAT },
    { header: "Day", key: "weekday", width: 8 },
    { header: "Money in", key: "in", width: 16, numFmt: CURRENCY_FORMAT },
    { header: "Money out", key: "out", width: 16, numFmt: CURRENCY_FORMAT },
    { header: "Net", key: "net", width: 16, numFmt: CURRENCY_FORMAT },
    { header: "Running total", key: "running", width: 16, numFmt: CURRENCY_FORMAT },
  ];
  const workbook = new ExcelJS.Workbook();
  const { sheet } = startSheet(workbook, `Summary ${month}`, { title: `Monthly Cash Summary — ${monthLabel(month)}`, subtitle: "Payments received and expenses paid, day by day", columns });

  let totalIn = 0;
  let totalOut = 0;
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const dayIn = (payments ?? []).filter((p) => dayKey(p.paid_at) === date).reduce((s, p) => s + Number(p.amount), 0);
    const dayOut = (expenses ?? []).filter((e) => e.expense_date === date).reduce((s, e) => s + Number(e.amount), 0);
    totalIn += dayIn;
    totalOut += dayOut;
    const [y, m] = month.split("-").map(Number);
    const row = sheet.addRow({
      date: new Date(Date.UTC(y, m - 1, d)),
      weekday: new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      in: dayIn,
      out: dayOut,
      net: dayIn - dayOut,
      running: totalIn - totalOut,
    });
    applyBodyRow(row, d - 1, columns);
    if (isFriday(date)) row.eachCell((cell) => (cell.font = { ...cell.font, color: { argb: XLSX_COLORS.muted } }));
  }
  applyTotalRow(sheet.addRow({ date: "Total", in: totalIn, out: totalOut, net: totalIn - totalOut }), columns);

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, `summary-${month}.xlsx`);
}
