import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { isoBounds, spanLabel } from "@/lib/date-range";
import { applyBodyRow, applyTotalRow, startSheet, CURRENCY_FORMAT, DATE_FORMAT, xlsxResponse, type SheetColumn } from "@/lib/xlsx-style";

type InvoiceRow = {
  id: string;
  invoice_number: number | null;
  created_at: string;
  vat_rate: number;
  customers: { name: string; trn_number: string | null } | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

const isKey = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const start = isKey(params.get("start")) ? params.get("start")! : new Date().toISOString().slice(0, 8) + "01";
  const end = isKey(params.get("end")) ? params.get("end")! : new Date().toISOString().slice(0, 10);
  const bounds = isoBounds(start, end);

  const supabase = await createClient();
  const [{ data: invoices }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, created_at, vat_rate, customers(name, trn_number), invoice_items(quantity, unit_price)")
      .eq("document_type", "invoice")
      .gte("created_at", bounds.start)
      .lte("created_at", bounds.end)
      .order("created_at")
      .returns<InvoiceRow[]>(),
    supabase.from("shop_settings").select("trn").limit(1).maybeSingle(),
  ]);

  const workbook = new ExcelJS.Workbook();
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
  const { sheet } = startSheet(workbook, "VAT Report", {
    title: "VAT Report — Output Tax",
    subtitle: `Period ${spanLabel(start, end)} ${end.slice(0, 4)}${settings?.trn ? `   ·   Our TRN ${settings.trn}` : ""}`,
    columns,
  });

  const totals = { net: 0, vat: 0, total: 0 };
  (invoices ?? []).forEach((inv, i) => {
    const net = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const vat = net * (inv.vat_rate / 100);
    totals.net += net;
    totals.vat += vat;
    totals.total += net + vat;
    const row = sheet.addRow({
      date: new Date(inv.created_at),
      number: formatInvoiceNumber(inv.invoice_number, inv.created_at) ?? "",
      customer: inv.customers?.name ?? "",
      trn: inv.customers?.trn_number ?? "",
      rate: `${inv.vat_rate}%`,
      net,
      vat,
      total: net + vat,
    });
    applyBodyRow(row, i, columns);
  });

  applyTotalRow(sheet.addRow({ date: "Total", customer: `${invoices?.length ?? 0} invoices`, net: totals.net, vat: totals.vat, total: totals.total }), columns);

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, `vat-report-${start}-to-${end}.xlsx`);
}
