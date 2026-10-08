import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { daysBetween, isoBounds, spanLabel } from "@/lib/date-range";
import { dayKey } from "@/lib/format";
import { applyBodyRow, applyTotalRow, startSheet, CURRENCY_FORMAT, DATE_FORMAT, xlsxResponse, type SheetColumn } from "@/lib/xlsx-style";
import { buildDashboard, share, AED2, INT, PCT } from "@/lib/xlsx-dashboard";
import { finalizeWorkbook } from "@/lib/xlsx-charts";

type InvoiceRow = {
  id: string;
  invoice_number: number | null;
  created_at: string;
  vat_rate: number;
  customers: { name: string; trn_number: string | null; customer_type: string | null } | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

const isKey = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const start = isKey(params.get("start")) ? params.get("start")! : new Date().toISOString().slice(0, 8) + "01";
  const end = isKey(params.get("end")) ? params.get("end")! : new Date().toISOString().slice(0, 10);
  const bounds = isoBounds(start, end);

  const supabase = await createClient();
  const [{ data: invoices }, { data: settings }, { data: credits }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, created_at, vat_rate, customers(name, trn_number, customer_type), invoice_items(quantity, unit_price)")
      .eq("document_type", "invoice")
      .gte("created_at", bounds.start)
      .lte("created_at", bounds.end)
      .order("created_at")
      .returns<InvoiceRow[]>(),
    supabase.from("shop_settings").select("trn").limit(1).maybeSingle(),
    supabase.from("credit_notes").select("amount, vat_amount").gte("created_at", bounds.start).lte("created_at", bounds.end),
  ]);

  const rows = (invoices ?? []).map((inv) => {
    const net = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const vat = net * (inv.vat_rate / 100);
    return { inv, net, vat, total: net + vat, day: dayKey(inv.created_at) };
  });
  const totals = rows.reduce((t, r) => ({ net: t.net + r.net, vat: t.vat + r.vat, total: t.total + r.total }), { net: 0, vat: 0, total: 0 });
  const creditVat = (credits ?? []).reduce((s, c) => s + Number(c.vat_amount ?? 0), 0);
  const creditNet = (credits ?? []).reduce((s, c) => s + Number(c.amount ?? 0), 0) - creditVat;

  // Over time: by day for short periods, by month for long ones.
  const byMonth = daysBetween(start, end) > 62;
  const bucket = (k: string) => (byMonth ? k.slice(0, 7) : k);
  const label = (k: string) =>
    byMonth
      ? new Date(`${k}-15T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })
      : new Date(`${k}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const series = [...rows.reduce((m, r) => m.set(bucket(r.day), (m.get(bucket(r.day)) ?? 0) + r.vat), new Map<string, number>())].sort((a, b) => a[0].localeCompare(b[0]));
  const customers = [
    ...rows.reduce((m, r) => {
      const name = r.inv.customers?.name ?? "Walk-in";
      const e = m.get(name) ?? { trn: r.inv.customers?.trn_number ?? "", n: 0, net: 0, vat: 0 };
      e.n++;
      e.net += r.net;
      e.vat += r.vat;
      return m.set(name, e);
    }, new Map<string, { trn: string; n: number; net: number; vat: number }>()),
  ].sort((a, b) => b[1].vat - a[1].vat);
  const withTrn = rows.filter((r) => r.inv.customers?.trn_number);
  const vatWithTrn = withTrn.reduce((s, r) => s + r.vat, 0);
  const cut = (n: string) => (n.length > 22 ? `${n.slice(0, 21)}…` : n);

  const workbook = new ExcelJS.Workbook();
  buildDashboard(workbook, {
    kicker: "VAT return · output tax",
    title: `${spanLabel(start, end)} ${end.slice(0, 4)}`,
    subtitle: `${start} to ${end}${settings?.trn ? `  ·  Our TRN ${settings.trn}` : ""}  ·  All amounts in AED`,
    kpis: [
      { label: "Taxable sales", value: totals.net, numFmt: AED2, note: `${rows.length} tax invoices` },
      { label: "Output VAT", value: totals.vat, numFmt: AED2, note: creditVat ? `Less ${creditVat.toFixed(2)} on credit notes` : "No credit notes" },
      { label: "VAT payable", value: totals.vat - creditVat, numFmt: AED2, tone: "neutral", note: "Output VAT after credit notes" },
      { label: "Total incl. VAT", value: totals.total, numFmt: AED2, note: rows.length ? `Average ${(totals.total / rows.length).toFixed(0)} per invoice` : "" },
    ],
    groups: [
      {
        widths: [18, 14, 14],
        top: {
          kind: "info",
          title: "Return details",
          rows: [
            ["Period start", start],
            ["Period end", end],
            ["Our TRN", settings?.trn ?? "Not set"],
            ["Standard rate", 0.05, PCT],
            ["Tax invoices", rows.length, INT],
            ["Credit notes", (credits ?? []).length, INT],
          ],
        },
        tables: [
          {
            title: "Summary (for the FTA return)",
            columns: [{ header: "Line" }, { header: "Net", numFmt: AED2 }, { header: "VAT", numFmt: AED2 }],
            rows: [
              ["Standard-rated sales", totals.net, totals.vat],
              ["Less credit notes", -creditNet, -creditVat],
            ],
            total: ["Net output VAT", totals.net - creditNet, totals.vat - creditVat],
          },
        ],
      },
      {
        widths: [14, 14, 14],
        top: { kind: "chart", chart: { title: byMonth ? "VAT by month" : "VAT by day", type: "column", categories: series.map(([k]) => label(k)), series: [{ name: "Output VAT", values: series.map(([, v]) => v) }], numFmt: "#,##0" } },
        tables: [
          {
            title: byMonth ? "By month" : "By day",
            columns: [{ header: byMonth ? "Month" : "Day" }, { header: "VAT", numFmt: AED2 }, { header: "Share", numFmt: PCT, bar: true }],
            rows: series.map(([k, v]) => [label(k), v, share(v, totals.vat)]),
            total: series.length ? ["Total", totals.vat, 1] : undefined,
            empty: "No invoices in this period",
          },
        ],
      },
      {
        widths: [20, 16, 12],
        top: {
          kind: "chart",
          chart: { title: "Business vs individual customers", type: "doughnut", categories: ["Customers with TRN", "Customers without TRN"], series: [{ name: "VAT", values: [vatWithTrn, totals.vat - vatWithTrn] }] },
        },
        tables: [
          {
            title: "Top customers by VAT",
            columns: [{ header: "Customer" }, { header: "TRN" }, { header: "VAT", numFmt: AED2 }],
            rows: customers.slice(0, 12).map(([n, v]) => [cut(n), v.trn || "—", v.vat]),
            empty: "No invoices in this period",
          },
        ],
      },
    ],
  });

  const columns: SheetColumn[] = [
    { header: "Date", key: "date", width: 13, numFmt: DATE_FORMAT },
    { header: "Invoice", key: "number", width: 16 },
    { header: "Customer", key: "customer", width: 30 },
    { header: "Customer TRN", key: "trn", width: 18 },
    { header: "VAT %", key: "rate", width: 8, align: "center" },
    { header: "Net (excl. VAT)", key: "net", width: 16, numFmt: CURRENCY_FORMAT },
    { header: "VAT", key: "vat", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "Total", key: "total", width: 16, numFmt: CURRENCY_FORMAT },
  ];
  const { sheet } = startSheet(workbook, "Tax invoices", {
    title: "VAT Report — Output Tax",
    subtitle: `Period ${spanLabel(start, end)} ${end.slice(0, 4)}${settings?.trn ? `   ·   Our TRN ${settings.trn}` : ""}`,
    columns,
    band: "Tax invoices",
  });
  rows.forEach(({ inv, net, vat, total }, i) => {
    const row = sheet.addRow({
      date: new Date(inv.created_at),
      number: formatInvoiceNumber(inv.invoice_number, inv.created_at) ?? "",
      customer: inv.customers?.name ?? "",
      trn: inv.customers?.trn_number ?? "",
      rate: `${inv.vat_rate}%`,
      net,
      vat,
      total,
    });
    applyBodyRow(row, i, columns);
  });
  applyTotalRow(sheet.addRow({ date: "Total", customer: `${rows.length} invoices`, net: totals.net, vat: totals.vat, total: totals.total }), columns);

  return xlsxResponse(await finalizeWorkbook(workbook), `vat-report-${start}-to-${end}.xlsx`);
}
