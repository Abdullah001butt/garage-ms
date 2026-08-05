import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyHeaderRow, applyBodyRow, applyTotalRow, xlsxResponse, CURRENCY_FORMAT } from "@/lib/xlsx-style";
import { fetchBuilderRows } from "@/lib/reports/builder";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();

  const rows = await fetchBuilderRows(supabase, {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    customerId: searchParams.get("customer") ?? undefined,
    itemType: searchParams.get("item_type") ?? undefined,
    mechanic: searchParams.get("mechanic") ?? undefined,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Customer", key: "customer", width: 24 },
    { header: "Vehicle", key: "vehicle", width: 24 },
    { header: "Mechanic", key: "mechanic", width: 18 },
    { header: "Description", key: "description", width: 30 },
    { header: "Type", key: "item_type", width: 12 },
    { header: "Qty", key: "qty", width: 8 },
    { header: "Unit Price", key: "unit_price", width: 14 },
    { header: "Total", key: "total", width: 14 },
  ];
  applyHeaderRow(sheet.getRow(1));

  rows.forEach((r, i) => {
    const row = sheet.addRow({
      date: new Date(r.invoice_date),
      customer: r.customer_name,
      vehicle: r.vehicle,
      mechanic: r.mechanic_name ?? "",
      description: r.description,
      item_type: r.item_type,
      qty: r.quantity,
      unit_price: r.unit_price,
      total: r.line_total,
    });
    row.getCell("date").numFmt = "dd/mm/yyyy";
    row.getCell("unit_price").numFmt = CURRENCY_FORMAT;
    row.getCell("total").numFmt = CURRENCY_FORMAT;
    applyBodyRow(row, i);
  });

  const totalRow = sheet.addRow({
    description: "TOTAL",
    total: rows.reduce((s, r) => s + r.line_total, 0),
  });
  totalRow.getCell("total").numFmt = CURRENCY_FORMAT;
  applyTotalRow(totalRow);

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "custom-report.xlsx");
}
