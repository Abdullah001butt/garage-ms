import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { dayKey, formatTime, formatWeekdayDate } from "@/lib/format";
import { isoBounds } from "@/lib/date-range";
import { applyBodyRow, applyTotalRow, startSheet, CURRENCY_FORMAT, XLSX_COLORS, xlsxResponse, type SheetColumn } from "@/lib/xlsx-style";
import { buildDashboard, share, AED2, INT, PCT } from "@/lib/xlsx-dashboard";
import { finalizeWorkbook } from "@/lib/xlsx-charts";

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
  const byMethod = [...(payments ?? []).reduce((m, p) => m.set(METHOD_LABEL[p.method] ?? p.method, (m.get(METHOD_LABEL[p.method] ?? p.method) ?? 0) + Number(p.amount)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const byCategory = [...(expenses ?? []).reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const cash = (payments ?? []).filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount), 0);
  const cashOut = totalOut; // expenses are paid from the drawer unless noted otherwise

  const workbook = new ExcelJS.Workbook();
  buildDashboard(workbook, {
    kicker: "Daily cash flow",
    title: formatWeekdayDate(date),
    subtitle: `${date}  ·  All amounts in AED`,
    kpis: [
      { label: "Money in", value: totalIn, numFmt: AED2, tone: "positive", note: `${payments?.length ?? 0} payments` },
      { label: "Money out", value: totalOut, numFmt: AED2, tone: totalOut ? "negative" : "neutral", note: `${expenses?.length ?? 0} expenses` },
      { label: "Net for the day", value: totalIn - totalOut, numFmt: AED2, tone: totalIn - totalOut >= 0 ? "positive" : "negative" },
    ],
    groups: [
      {
        widths: [18, 14, 12],
        top: {
          kind: "info",
          title: "Day details",
          rows: [
            ["Date", date],
            ["Currency", "AED"],
            ["Payments", payments?.length ?? 0, INT],
            ["Expenses", expenses?.length ?? 0, INT],
            ["Cash received", cash, AED2],
            ["Cash in drawer change", cash - cashOut, AED2],
          ],
        },
        tables: [
          {
            title: "Summary",
            columns: [{ header: "Line" }, { header: "Amount", numFmt: AED2 }, { header: "Count", numFmt: INT, align: "center" }],
            rows: [
              ["Money in", totalIn, payments?.length ?? 0],
              ["Money out", -totalOut, expenses?.length ?? 0],
            ],
            total: ["Net", totalIn - totalOut, null],
          },
        ],
      },
      {
        widths: [18, 14, 10],
        top: { kind: "chart", chart: { title: "Money in by method", type: "doughnut", categories: byMethod.map(([m]) => m), series: [{ name: "Received", values: byMethod.map(([, v]) => v) }] } },
        tables: [
          {
            title: "By payment method",
            columns: [{ header: "Method" }, { header: "Amount", numFmt: AED2 }, { header: "Share", numFmt: PCT, bar: true }],
            rows: byMethod.map(([m, v]) => [m, v, share(v, totalIn)]),
            total: byMethod.length ? ["Total", totalIn, 1] : undefined,
            empty: "No payments this day",
          },
        ],
      },
      {
        widths: [18, 14, 10],
        top: { kind: "chart", chart: { title: "Money in vs out", type: "column", labels: "value", categories: ["Money in", "Money out", "Net"], series: [{ name: "AED", values: [totalIn, totalOut, totalIn - totalOut], color: "8E97BC" }] } },
        tables: [
          {
            title: "Money out by category",
            columns: [{ header: "Category" }, { header: "Amount", numFmt: AED2 }, { header: "Share", numFmt: PCT, bar: true }],
            rows: byCategory.map(([c, v]) => [c, v, share(v, totalOut)]),
            total: byCategory.length ? ["Total", totalOut, 1] : undefined,
            empty: "No expenses this day",
          },
        ],
      },
    ],
  });
  const { sheet } = startSheet(workbook, "Ledger", { title: "Daily Cash Flow", subtitle: formatWeekdayDate(date), columns, band: "Every payment and expense" });

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

  return xlsxResponse(await finalizeWorkbook(workbook), `cashflow-${date}.xlsx`);
}
