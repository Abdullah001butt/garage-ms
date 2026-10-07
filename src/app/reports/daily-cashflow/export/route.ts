import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { dayKey, formatTime, formatWeekdayDate } from "@/lib/format";
import { isoBounds } from "@/lib/date-range";
import { applyBodyRow, applyTotalRow, startSheet, CURRENCY_FORMAT, XLSX_COLORS, xlsxResponse, type SheetColumn } from "@/lib/xlsx-style";

type PaymentRow = {
  amount: number;
  method: string;
  paid_at: string;
  invoices: {
    customers: { name: string } | null;
    job_cards: { description: string; vehicles: { plate_number: string } | null } | null;
  } | null;
};

type ExpenseRow = { category: string; description: string | null; amount: number };

const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", bank_transfer: "Bank transfer", ziina: "Ziina", other: "Other" };

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("date");
  const date = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : dayKey(new Date());
  const { start, end } = isoBounds(date, date);

  const supabase = await createClient();
  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, method, paid_at, invoices(customers(name), job_cards(description, vehicles(plate_number)))")
      .gte("paid_at", start)
      .lte("paid_at", end)
      .order("paid_at")
      .returns<PaymentRow[]>(),
    supabase.from("expenses").select("category, description, amount").eq("expense_date", date).returns<ExpenseRow[]>(),
  ]);

  const totalIn = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalOut = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  // One ledger: money in first, then money out, each with a subtotal, then the day's net.
  const columns: SheetColumn[] = [
    { header: "Type", key: "type", width: 10 },
    { header: "Time / Category", key: "when", width: 18 },
    { header: "Customer / Description", key: "who", width: 32 },
    { header: "Vehicle / Work", key: "what", width: 34 },
    { header: "Method", key: "method", width: 13 },
    { header: "In", key: "in", width: 15, numFmt: CURRENCY_FORMAT },
    { header: "Out", key: "out", width: 15, numFmt: CURRENCY_FORMAT },
  ];
  const workbook = new ExcelJS.Workbook();
  const { sheet } = startSheet(workbook, `Cash ${date}`, { title: "Daily Cash Flow", subtitle: formatWeekdayDate(date), columns });

  let i = 0;
  for (const p of payments ?? []) {
    const row = sheet.addRow({
      type: "In",
      when: formatTime(p.paid_at),
      who: p.invoices?.customers?.name ?? "",
      what: [p.invoices?.job_cards?.vehicles?.plate_number, p.invoices?.job_cards?.description].filter(Boolean).join(" · ") || "Counter sale",
      method: METHOD_LABEL[p.method] ?? p.method,
      in: Number(p.amount),
    });
    applyBodyRow(row, i++, columns);
    row.getCell("type").font = { name: "Calibri", size: 10, bold: true, color: { argb: XLSX_COLORS.positive } };
  }
  for (const e of expenses ?? []) {
    const row = sheet.addRow({ type: "Out", when: e.category, who: e.description ?? "", out: Number(e.amount) });
    applyBodyRow(row, i++, columns);
    row.getCell("type").font = { name: "Calibri", size: 10, bold: true, color: { argb: XLSX_COLORS.negative } };
  }
  if (i === 0) applyBodyRow(sheet.addRow({ type: "", who: "No money in or out this day" }), 0, columns);

  applyTotalRow(sheet.addRow({ type: "Totals", who: `${payments?.length ?? 0} payments · ${expenses?.length ?? 0} expenses`, in: totalIn, out: totalOut }), columns);
  const net = sheet.addRow({ type: "Net", in: totalIn - totalOut });
  applyTotalRow(net, columns);
  net.getCell("in").font = { name: "Calibri", size: 11, bold: true, color: { argb: totalIn - totalOut >= 0 ? XLSX_COLORS.positive : XLSX_COLORS.negative } };

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, `cashflow-${date}.xlsx`);
}
