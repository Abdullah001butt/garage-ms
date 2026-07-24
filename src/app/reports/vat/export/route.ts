import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyHeaderRow, applyBodyRow, applyTotalRow, CURRENCY_FORMAT, xlsxResponse } from "@/lib/xlsx-style";

type InvoiceRow = {
  id: string;
  created_at: string;
  vat_rate: number;
  customers: { name: string } | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, created_at, vat_rate, customers(name), invoice_items(quantity, unit_price)")
    .eq("document_type", "invoice")
    .gte("created_at", start)
    .lte("created_at", `${end}T23:59:59`)
    .order("created_at")
    .returns<InvoiceRow[]>();

  const rows = (invoices ?? []).map((inv) => {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const vat = subtotal * (inv.vat_rate / 100);
    return {
      date: new Date(inv.created_at),
      customer: inv.customers?.name ?? "",
      net: subtotal,
      vat,
      total: subtotal + vat,
    };
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet("VAT Report", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Net", key: "net", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { header: "VAT", key: "vat", width: 16, style: { numFmt: CURRENCY_FORMAT } },
    { header: "Total", key: "total", width: 16, style: { numFmt: CURRENCY_FORMAT } },
  ];
  applyHeaderRow(sheet.getRow(1));

  rows.forEach((r, i) => {
    const row = sheet.addRow({
      date: r.date,
      customer: r.customer,
      net: r.net,
      vat: r.vat,
      total: r.total,
    });
    row.getCell("date").numFmt = "dd/mm/yyyy";
    applyBodyRow(row, i);
  });

  const totalRow = sheet.addRow({
    date: "",
    customer: "TOTAL",
    net: rows.reduce((s, r) => s + r.net, 0),
    vat: rows.reduce((s, r) => s + r.vat, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
  });
  applyTotalRow(totalRow);

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, `vat-report-${start}-to-${end}.xlsx`);
}
