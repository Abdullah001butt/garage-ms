import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyBodyRow, applyTotalRow, startSheet, CURRENCY_FORMAT, DATE_FORMAT, type SheetColumn } from "@/lib/xlsx-style";
import { buildDashboard, share, AED, INT, PCT } from "@/lib/xlsx-dashboard";
import { dayKey } from "@/lib/format";
import { shiftMonth } from "@/lib/salary";

type ExpenseRow = {
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
};

const shortMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
};

export async function buildExpensesWorkbook() {
  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("category, description, amount, expense_date")
    .order("expense_date", { ascending: false })
    .returns<ExpenseRow[]>();
  const list = expenses ?? [];

  const total = list.reduce((s, e) => s + Number(e.amount), 0);
  const thisMonth = dayKey(new Date()).slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(thisMonth, i - 11));
  const perMonth = months.map((m) => list.filter((e) => e.expense_date.slice(0, 7) === m).reduce((s, e) => s + Number(e.amount), 0));
  const last12 = perMonth.reduce((s, v) => s + v, 0);
  const activeMonths = perMonth.filter((v) => v > 0).length || 1;
  const byCategory = [...list.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const catThisMonth = [...list.filter((e) => e.expense_date.slice(0, 7) === thisMonth).reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount)), new Map<string, number>())].sort(
    (a, b) => b[1] - a[1]
  );
  const biggest = [...list].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 8);
  const dates = list.map((e) => e.expense_date).sort();
  const nowVal = perMonth[11];
  const prevVal = perMonth[10];

  const workbook = new ExcelJS.Workbook();
  buildDashboard(workbook, {
    kicker: "Expenses",
    title: "Where the money goes",
    subtitle: dates.length ? `${dates[0]} to ${dates.at(-1)}  ·  ${list.length} entries  ·  All amounts in AED` : "No expenses recorded yet",
    kpis: [
      { label: "All expenses", value: total, numFmt: AED, note: `${list.length} entries` },
      { label: "This month", value: nowVal, numFmt: AED, note: prevVal ? `${nowVal >= prevVal ? "▲" : "▼"} ${Math.abs(((nowVal - prevVal) / prevVal) * 100).toFixed(0)}% vs last month` : "Nothing last month" },
      { label: "Monthly average", value: last12 / activeMonths, numFmt: AED, note: "Last 12 months" },
    ],
    groups: [
      {
        widths: [14, 14, 10],
        top: {
          kind: "info",
          title: "Report details",
          rows: [
            ["Exported", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" })],
            ["From", dates[0] ?? "—"],
            ["To", dates.at(-1) ?? "—"],
            ["Currency", "AED"],
            ["Entries", list.length, INT],
            ["Categories", byCategory.length, INT],
            ["Biggest category", byCategory[0] ? `${byCategory[0][0]} (${Math.round(share(byCategory[0][1], total) * 100)}%)` : "—"],
          ],
        },
        tables: [
          {
            title: "Last 12 months",
            columns: [{ header: "Month" }, { header: "Spent", numFmt: AED }, { header: "Share", numFmt: PCT, bar: true }],
            rows: months.map((m, i) => [shortMonth(m), perMonth[i], share(perMonth[i], last12)]),
            total: ["Total", last12, last12 ? 1 : 0],
          },
        ],
      },
      {
        widths: [20, 14, 10],
        top: { kind: "chart", chart: { title: "By category", type: "doughnut", categories: byCategory.slice(0, 7).map(([c]) => c), series: [{ name: "Spent", values: byCategory.slice(0, 7).map(([, v]) => v) }] } },
        tables: [
          {
            title: "All time by category",
            columns: [{ header: "Category" }, { header: "Spent", numFmt: AED }, { header: "Share", numFmt: PCT, bar: true }],
            rows: byCategory.map(([c, v]) => [c, v, share(v, total)]),
            total: ["Total", total, total ? 1 : 0],
            empty: "No expenses yet",
          },
        ],
      },
      {
        widths: [16, 14, 14],
        top: { kind: "chart", chart: { title: "Spending · 12 months", type: "column", categories: months.map(shortMonth), series: [{ name: "Spent", values: perMonth, color: "E8ABA6" }] } },
        tables: [
          {
            title: "This month by category",
            columns: [{ header: "Category" }, { header: "Spent", numFmt: AED }, { header: "Share", numFmt: PCT, bar: true }],
            rows: catThisMonth.map(([c, v]) => [c, v, share(v, nowVal)]),
            total: catThisMonth.length ? ["Total", nowVal, 1] : undefined,
            empty: "Nothing spent this month",
          },
          {
            title: "Biggest single expenses",
            columns: [{ header: "Date" }, { header: "Category" }, { header: "Amount", numFmt: AED }],
            rows: biggest.map((e) => [e.expense_date, e.category, Number(e.amount)]),
            empty: "No expenses yet",
          },
        ],
      },
    ],
  });

  const columns: SheetColumn[] = [
    { header: "Date", key: "date", width: 14, numFmt: DATE_FORMAT },
    { header: "Category", key: "category", width: 22 },
    { header: "Description", key: "description", width: 44 },
    { header: "Amount", key: "amount", width: 18, numFmt: CURRENCY_FORMAT },
  ];
  const { sheet } = startSheet(workbook, "All expenses", { title: "Expenses", subtitle: `${list.length} entries`, columns, band: "All expenses" });
  list.forEach((e, i) => {
    const row = sheet.addRow({ date: new Date(e.expense_date), category: e.category, description: e.description ?? "", amount: Number(e.amount) });
    applyBodyRow(row, i, columns);
  });
  applyTotalRow(sheet.addRow({ date: "Total", category: "", description: `${list.length} expenses`, amount: total }), columns);

  return workbook;
}
