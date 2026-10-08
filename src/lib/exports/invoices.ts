import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { applyBodyRow, applyTotalRow, startSheet, statusCell, CURRENCY_FORMAT, DATE_FORMAT, type SheetColumn } from "@/lib/xlsx-style";
import { buildDashboard, share, AED, INT, PCT } from "@/lib/xlsx-dashboard";
import { dayKey } from "@/lib/format";
import { shiftMonth } from "@/lib/salary";

type InvoiceRow = {
  id: string;
  invoice_number: number | null;
  created_at: string;
  status: string;
  discount: number;
  vat_rate: number;
  customers: { name: string; phone: string } | null;
  job_cards: { description: string; vehicles: { plate_number: string } | null } | null;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
};

const STATUS: Record<string, { label: string; tone: "positive" | "warning" | "negative" }> = {
  paid: { label: "Paid", tone: "positive" },
  partial: { label: "Part paid", tone: "warning" },
  unpaid: { label: "Unpaid", tone: "negative" },
  credited: { label: "Credited", tone: "warning" },
};
const shortMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
};

/** All invoices, or only `ids` when exporting a selection. */
export async function buildInvoicesWorkbook(ids?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, created_at, status, discount, vat_rate, customers(name, phone), job_cards(description, vehicles(plate_number)), invoice_items(quantity, unit_price), payments(amount)"
    )
    .eq("document_type", "invoice")
    .order("created_at", { ascending: false });
  if (ids?.length) query = query.in("id", ids);
  const { data: invoices } = await query.returns<InvoiceRow[]>();

  const calc = (invoices ?? []).map((inv) => {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const vat = subtotal * (Number(inv.vat_rate ?? 5) / 100);
    const total = subtotal + vat - Number(inv.discount);
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    return { inv, subtotal, vat, total, paid, balance: inv.status === "credited" ? 0 : Math.max(total - paid, 0), month: dayKey(inv.created_at).slice(0, 7) };
  });
  const invoiced = calc.reduce((s, c) => s + c.total, 0);
  const collected = calc.reduce((s, c) => s + c.paid, 0);
  const owed = calc.reduce((s, c) => s + c.balance, 0);
  const byStatus = ["paid", "partial", "unpaid", "credited"]
    .map((st) => {
      const list = calc.filter((c) => c.inv.status === st);
      return { label: STATUS[st].label, tone: STATUS[st].tone, n: list.length, total: list.reduce((s, c) => s + c.total, 0) };
    })
    .filter((x) => x.n);
  const latest = calc.length ? calc.map((c) => c.month).sort().at(-1)! : dayKey(new Date()).slice(0, 7);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(latest, i - 5));
  const perMonth = months.map((m) => {
    const list = calc.filter((c) => c.month === m);
    return { m, n: list.length, total: list.reduce((s, c) => s + c.total, 0), paid: list.reduce((s, c) => s + c.paid, 0) };
  });
  const customers = [
    ...calc.reduce((map, c) => {
      const name = c.inv.customers?.name ?? "Walk-in";
      const e = map.get(name) ?? { n: 0, total: 0, balance: 0 };
      e.n++;
      e.total += c.total;
      e.balance += c.balance;
      return map.set(name, e);
    }, new Map<string, { n: number; total: number; balance: number }>()),
  ];
  const topSpend = [...customers].sort((a, b) => b[1].total - a[1].total);
  const topOwed = customers.filter(([, v]) => v.balance > 0.01).sort((a, b) => b[1].balance - a[1].balance);
  const cut = (n: string) => (n.length > 22 ? `${n.slice(0, 21)}…` : n);
  const dates = calc.map((c) => dayKey(c.inv.created_at)).sort();

  const workbook = new ExcelJS.Workbook();
  buildDashboard(workbook, {
    kicker: ids?.length ? "Invoices · selection" : "Invoices",
    title: ids?.length ? `${calc.length} selected invoices` : "Invoice book",
    subtitle: dates.length ? `${dates[0]} to ${dates.at(-1)}  ·  All amounts in AED, VAT included` : "No invoices yet",
    kpis: [
      { label: "Invoices", value: calc.length, numFmt: INT, note: `${byStatus.find((b) => b.label === "Unpaid")?.n ?? 0} unpaid · ${byStatus.find((b) => b.label === "Part paid")?.n ?? 0} part paid` },
      { label: "Total invoiced", value: invoiced, numFmt: AED, note: `Average ${calc.length ? Math.round(invoiced / calc.length).toLocaleString("en-US") : 0} per invoice` },
      { label: "Collected", value: collected, numFmt: AED, tone: "positive", note: `${(share(collected, invoiced) * 100).toFixed(0)}% of invoiced` },
      { label: "Outstanding", value: owed, numFmt: AED, tone: owed > 0 ? "negative" : "positive", note: `${topOwed.length} customers owe money` },
    ],
    groups: [
      {
        widths: [16, 9, 14, 10],
        top: {
          kind: "info",
          title: "Report details",
          rows: [
            ["Exported", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" })],
            ["From", dates[0] ?? "—"],
            ["To", dates.at(-1) ?? "—"],
            ["Currency", "AED"],
            ["Invoices", calc.length, INT],
            ["VAT charged", calc.reduce((s, c) => s + c.vat, 0), AED],
          ],
        },
        tables: [
          {
            title: "By status",
            columns: [{ header: "Status" }, { header: "Count", numFmt: INT, align: "center" }, { header: "Amount", numFmt: AED }, { header: "Share", numFmt: PCT }],
            rows: byStatus.map((b) => [b.label, b.n, b.total, share(b.total, invoiced)]),
            tones: byStatus.map((b) => [b.tone, null, null, null]),
            total: ["Total", calc.length, invoiced, invoiced ? 1 : 0],
          },
        ],
      },
      {
        widths: [20, 14, 10],
        top: { kind: "chart", chart: { title: "Collected vs outstanding", type: "doughnut", categories: ["Collected", "Outstanding"], series: [{ name: "Amount", values: [collected, owed] }] } },
        tables: [
          {
            title: "Biggest balances",
            columns: [{ header: "Customer" }, { header: "Owes", numFmt: AED }, { header: "Share", numFmt: PCT, bar: true }],
            rows: topOwed.slice(0, 10).map(([n, v]) => [n, v.balance, share(v.balance, owed)]),
            total: topOwed.length ? ["Total owed", owed, 1] : undefined,
            empty: "Nobody owes anything",
          },
        ],
      },
      {
        widths: [12, 8, 14, 14],
        top: {
          kind: "chart",
          chart: {
            title: "Invoiced vs collected · 6 months",
            type: "column",
            categories: months.map(shortMonth),
            series: [
              { name: "Invoiced", values: perMonth.map((p) => p.total) },
              { name: "Collected", values: perMonth.map((p) => p.paid) },
            ],
          },
        },
        tables: [
          {
            title: "By month",
            columns: [{ header: "Month" }, { header: "Invoices", numFmt: INT, align: "center" }, { header: "Invoiced", numFmt: AED }, { header: "Collected", numFmt: AED }],
            rows: perMonth.map((p) => [shortMonth(p.m), p.n, p.total, p.paid]),
            total: ["Total", perMonth.reduce((s, p) => s + p.n, 0), perMonth.reduce((s, p) => s + p.total, 0), perMonth.reduce((s, p) => s + p.paid, 0)],
          },
        ],
      },
      {
        widths: [22, 8, 14],
        top: {
          kind: "chart",
          chart: { title: "Top customers", type: "bar", labels: "value", categories: topSpend.slice(0, 6).map(([n]) => cut(n)), series: [{ name: "Invoiced", values: topSpend.slice(0, 6).map(([, v]) => v.total) }] },
        },
        tables: [
          {
            title: "Customer totals",
            columns: [{ header: "Customer" }, { header: "Invoices", numFmt: INT, align: "center" }, { header: "Invoiced", numFmt: AED }],
            rows: topSpend.slice(0, 10).map(([n, v]) => [n, v.n, v.total]),
            empty: "No invoices",
          },
        ],
      },
    ],
  });

  const columns: SheetColumn[] = [
    { header: "Invoice", key: "number", width: 16 },
    { header: "Date", key: "date", width: 13, numFmt: DATE_FORMAT },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Vehicle", key: "vehicle", width: 12 },
    { header: "Work", key: "job", width: 34 },
    { header: "Net", key: "subtotal", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "VAT", key: "vat", width: 12, numFmt: CURRENCY_FORMAT },
    { header: "Discount", key: "discount", width: 12, numFmt: CURRENCY_FORMAT },
    { header: "Total", key: "total", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "Paid", key: "paid", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "Balance", key: "balance", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "Status", key: "status", width: 11, align: "center" },
  ];
  const { sheet } = startSheet(workbook, "All invoices", {
    band: "All invoices",
    title: ids?.length ? "Invoices — selection" : "Invoices",
    subtitle: `${invoices?.length ?? 0} invoices`,
    columns,
    freezeColumns: 1,
  });

  const totals = { subtotal: 0, vat: 0, discount: 0, total: 0, paid: 0 };
  calc.forEach(({ inv, subtotal, vat, total, paid, balance }, i) => {
    totals.subtotal += subtotal;
    totals.vat += vat;
    totals.discount += Number(inv.discount);
    totals.total += total;
    totals.paid += paid;

    const row = sheet.addRow({
      number: formatInvoiceNumber(inv.invoice_number, inv.created_at) ?? "",
      date: new Date(inv.created_at),
      customer: inv.customers?.name ?? "",
      phone: inv.customers?.phone ?? "",
      vehicle: inv.job_cards?.vehicles?.plate_number ?? "",
      job: inv.job_cards?.description ?? "Counter sale",
      subtotal,
      vat,
      discount: Number(inv.discount),
      total,
      paid,
      balance,
      status: STATUS[inv.status]?.label ?? inv.status,
    });
    applyBodyRow(row, i, columns);
    statusCell(row.getCell("status"), STATUS[inv.status]?.tone ?? "warning");
  });

  const totalRow = sheet.addRow({
    number: "Total",
    customer: `${invoices?.length ?? 0} invoices`,
    subtotal: totals.subtotal,
    vat: totals.vat,
    discount: totals.discount,
    total: totals.total,
    paid: totals.paid,
    balance: owed,
  });
  applyTotalRow(totalRow, columns);

  return workbook;
}
