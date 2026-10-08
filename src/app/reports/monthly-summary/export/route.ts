import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { dayKey } from "@/lib/format";
import { isoBounds } from "@/lib/date-range";
import { currentMonth, isFriday, monthBounds, monthLabel, shiftMonth } from "@/lib/salary";
import { applyBodyRow, applyTotalRow, startSheet, CURRENCY_FORMAT, DATE_FORMAT, XLSX_COLORS, xlsxResponse, type SheetColumn } from "@/lib/xlsx-style";
import { buildDashboard, share, AED, INT, PCT } from "@/lib/xlsx-dashboard";
import { finalizeWorkbook } from "@/lib/xlsx-charts";

type Payment = { amount: number; paid_at: string; method: string; invoices: { customers: { name: string } | null } | null };
type Expense = { amount: number; expense_date: string; category: string };
type Invoice = { created_at: string; invoice_items: { item_type: string; quantity: number; unit_price: number }[] };

const METHOD: Record<string, string> = { cash: "Cash", card: "Card", bank_transfer: "Bank transfer", ziina: "Ziina", other: "Other" };
const shortMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
};
// A % change only means something against a positive starting point.
const pct = (now: number, before: number) => (before > 0 ? (now - before) / before : null);

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("month");
  const month = param && /^\d{4}-\d{2}$/.test(param) ? param : currentMonth();
  const { start, end, days } = monthBounds(month);
  const prev = shiftMonth(month, -1);
  const sixStart = monthBounds(shiftMonth(month, -5)).start;
  const range = isoBounds(sixStart, end);

  const supabase = await createClient();
  const [{ data: payments }, { data: expenses }, { data: invoices }, { data: jobs }] = await Promise.all([
    supabase.from("payments").select("amount, paid_at, method, invoices(customers(name))").gte("paid_at", range.start).lte("paid_at", range.end).returns<Payment[]>(),
    supabase.from("expenses").select("amount, expense_date, category").gte("expense_date", sixStart).lte("expense_date", end).returns<Expense[]>(),
    supabase
      .from("invoices")
      .select("created_at, invoice_items(item_type, quantity, unit_price)")
      .eq("document_type", "invoice")
      .gte("created_at", isoBounds(monthBounds(prev).start, end).start)
      .lte("created_at", range.end)
      .returns<Invoice[]>(),
    supabase.from("job_cards").select("status, completed_at").eq("status", "completed").gte("completed_at", isoBounds(monthBounds(prev).start, end).start).lte("completed_at", range.end),
  ]);

  const inMonth = (m: string) => (key: string) => key.slice(0, 7) === m;
  const pay = (m: string) => (payments ?? []).filter((p) => inMonth(m)(dayKey(p.paid_at)));
  const exp = (m: string) => (expenses ?? []).filter((e) => inMonth(m)(e.expense_date));
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
  const moneyIn = (m: string) => sum(pay(m), (p) => Number(p.amount));
  const moneyOut = (m: string) => sum(exp(m), (e) => Number(e.amount));
  const invoicesIn = (m: string) => (invoices ?? []).filter((i) => inMonth(m)(dayKey(i.created_at)));
  const jobsDone = (m: string) => (jobs ?? []).filter((j) => j.completed_at && inMonth(m)(dayKey(j.completed_at))).length;

  const inNow = moneyIn(month);
  const outNow = moneyOut(month);
  const inPrev = moneyIn(prev);
  const outPrev = moneyOut(prev);
  const netNow = inNow - outNow;
  const netPrev = inPrev - outPrev;

  // Revenue mix from invoices issued this month.
  const mix = { labor: 0, part: 0, service: 0 };
  for (const inv of invoicesIn(month)) for (const it of inv.invoice_items) mix[(it.item_type as keyof typeof mix) ?? "service"] += Number(it.quantity) * Number(it.unit_price);

  const byCategory = [...exp(month).reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const byMethod = [...pay(month).reduce((m, p) => m.set(METHOD[p.method] ?? p.method, (m.get(METHOD[p.method] ?? p.method) ?? 0) + Number(p.amount)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const byCustomer = [
    ...pay(month).reduce((m, p) => {
      const name = p.invoices?.customers?.name ?? "Walk-in / other";
      const e = m.get(name) ?? { n: 0, total: 0 };
      e.n++;
      e.total += Number(p.amount);
      return m.set(name, e);
    }, new Map<string, { n: number; total: number }>()),
  ].sort((a, b) => b[1].total - a[1].total);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const change = (now: number, before: number) => pct(now, before);
  const tone = (v: number | null, goodWhenUp = true) => (v === null || Math.abs(v) < 0.005 ? null : (v > 0) === goodWhenUp ? "positive" : "negative");
  const arrow = (v: number | null) => (v === null ? "No data last month" : `${v >= 0 ? "▲" : "▼"} ${Math.abs(v * 100).toFixed(0)}% vs ${monthLabel(prev).split(" ")[0]}`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  buildDashboard(workbook, {
    kicker: "Monthly business summary",
    title: monthLabel(month),
    subtitle: `${start} to ${end}  ·  All amounts in AED  ·  Generated ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" })}`,
    kpis: [
      { label: "Money in", value: inNow, numFmt: AED, note: arrow(change(inNow, inPrev)) },
      { label: "Money out", value: outNow, numFmt: AED, note: arrow(change(outNow, outPrev)) },
      { label: "Net", value: netNow, numFmt: AED, tone: netNow >= 0 ? "positive" : "negative", note: inNow ? `${((netNow / inNow) * 100).toFixed(1)}% of money in` : "" },
      { label: "Jobs completed", value: jobsDone(month), numFmt: INT, note: `${jobsDone(prev)} last month` },
    ],
    groups: [
      {
        widths: [17, 13, 13, 10],
        top: {
          kind: "info",
          title: "Report details",
          rows: [
            ["Month", monthLabel(month)],
            ["Start date", start],
            ["End date", end],
            ["Currency", "AED"],
            ["Payments", pay(month).length, INT],
            ["Expenses", exp(month).length, INT],
            ["Invoices issued", invoicesIn(month).length, INT],
          ],
        },
        tables: [
          {
            title: `Compared with ${monthLabel(prev).split(" ")[0]}`,
            columns: [{ header: "Item" }, { header: "This month", numFmt: AED }, { header: "Last month", numFmt: AED }, { header: "Change", numFmt: PCT }],
            rows: [
              ["Money in", inNow, inPrev, change(inNow, inPrev)],
              ["Money out", outNow, outPrev, change(outNow, outPrev)],
              ["Net", netNow, netPrev, change(netNow, netPrev)],
              ["Invoices issued", { v: invoicesIn(month).length, fmt: INT }, { v: invoicesIn(prev).length, fmt: INT }, change(invoicesIn(month).length, invoicesIn(prev).length)],
              ["Jobs completed", { v: jobsDone(month), fmt: INT }, { v: jobsDone(prev), fmt: INT }, change(jobsDone(month), jobsDone(prev))],
            ],
            tones: [
              [null, null, null, tone(change(inNow, inPrev))],
              [null, null, null, tone(change(outNow, outPrev), false)],
              [null, null, null, tone(change(netNow, netPrev))],
              [null, null, null, tone(change(invoicesIn(month).length, invoicesIn(prev).length))],
              [null, null, null, tone(change(jobsDone(month), jobsDone(prev)))],
            ],
          },
        ],
      },
      {
        widths: [18, 13, 11],
        top: { kind: "chart", chart: { title: "Revenue mix", type: "doughnut", categories: ["Labour", "Parts", "Services"], series: [{ name: "Invoiced", values: [mix.labor, mix.part, mix.service] }] } },
        tables: [
          {
            title: "Expenses by category",
            columns: [{ header: "Category" }, { header: "Amount", numFmt: AED }, { header: "Share", numFmt: PCT, bar: true }],
            rows: byCategory.map(([c, a]) => [c, a, share(a, outNow)]),
            total: ["Total", outNow, outNow ? 1 : 0],
            empty: "No expenses this month",
          },
        ],
      },
      {
        widths: [15, 13, 13],
        top: {
          kind: "chart",
          chart: {
            title: "Money in vs out · 6 months",
            type: "column",
            categories: months.map(shortMonth),
            series: [
              { name: "Money in", values: months.map(moneyIn) },
              { name: "Money out", values: months.map(moneyOut) },
            ],
          },
        },
        tables: [
          {
            title: "Money in by method",
            columns: [{ header: "Method" }, { header: "Amount", numFmt: AED }, { header: "Share", numFmt: PCT, bar: true }],
            rows: byMethod.map(([m, a]) => [m, a, share(a, inNow)]),
            total: ["Total", inNow, inNow ? 1 : 0],
            empty: "No payments this month",
          },
        ],
      },
      {
        widths: [22, 9, 13],
        top: {
          kind: "chart",
          chart: {
            title: "Top customers",
            type: "bar",
            labels: "value",
            categories: byCustomer.slice(0, 6).map(([n]) => (n.length > 22 ? `${n.slice(0, 21)}…` : n)),
            series: [{ name: "Paid", values: byCustomer.slice(0, 6).map(([, v]) => v.total), color: "8E97BC" }],
          },
        },
        tables: [
          {
            title: "Customers who paid",
            columns: [{ header: "Customer" }, { header: "Payments", numFmt: INT, align: "center" }, { header: "Paid", numFmt: AED }],
            rows: byCustomer.slice(0, 10).map(([n, v]) => [n, v.n, v.total]),
            empty: "No payments this month",
          },
        ],
      },
    ],
  });

  // Day by day, as before.
  const columns: SheetColumn[] = [
    { header: "Date", key: "date", width: 14, numFmt: DATE_FORMAT },
    { header: "Day", key: "weekday", width: 8 },
    { header: "Money in", key: "in", width: 16, numFmt: CURRENCY_FORMAT },
    { header: "Money out", key: "out", width: 16, numFmt: CURRENCY_FORMAT },
    { header: "Net", key: "net", width: 16, numFmt: CURRENCY_FORMAT },
    { header: "Running total", key: "running", width: 16, numFmt: CURRENCY_FORMAT },
  ];
  const { sheet } = startSheet(workbook, "Day by day", { title: `Daily Cash — ${monthLabel(month)}`, subtitle: "Payments received and expenses paid, day by day", columns, band: "Day by day" });
  let totalIn = 0;
  let totalOut = 0;
  const [y, m] = month.split("-").map(Number);
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const dayIn = (payments ?? []).filter((p) => dayKey(p.paid_at) === date).reduce((s, p) => s + Number(p.amount), 0);
    const dayOut = (expenses ?? []).filter((e) => e.expense_date === date).reduce((s, e) => s + Number(e.amount), 0);
    totalIn += dayIn;
    totalOut += dayOut;
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

  return xlsxResponse(await finalizeWorkbook(workbook), `business-summary-${month}.xlsx`);
}
