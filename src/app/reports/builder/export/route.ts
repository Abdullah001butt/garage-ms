import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyBodyRow, applyTotalRow, startSheet, xlsxResponse, CURRENCY_FORMAT, DATE_FORMAT, NUMBER_FORMAT, type SheetColumn } from "@/lib/xlsx-style";
import { fetchBuilderRows } from "@/lib/reports/builder";

const TYPE_LABEL: Record<string, string> = { part: "Part", labor: "Labour", service: "Service" };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();
  const filters = {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    customerId: searchParams.get("customer") ?? undefined,
    itemType: searchParams.get("item_type") ?? undefined,
    mechanic: searchParams.get("mechanic") ?? undefined,
  };
  const rows = await fetchBuilderRows(supabase, filters);

  const described = [
    filters.from || filters.to ? `${filters.from ?? "start"} to ${filters.to ?? "today"}` : "All dates",
    filters.itemType ? TYPE_LABEL[filters.itemType] ?? filters.itemType : null,
    filters.mechanic ? `Mechanic: ${filters.mechanic}` : null,
    rows.length && filters.customerId ? `Customer: ${rows[0].customer_name}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");

  const columns: SheetColumn[] = [
    { header: "Date", key: "date", width: 13, numFmt: DATE_FORMAT },
    { header: "Customer", key: "customer", width: 26 },
    { header: "Vehicle", key: "vehicle", width: 24 },
    { header: "Mechanic", key: "mechanic", width: 18 },
    { header: "Description", key: "description", width: 32 },
    { header: "Type", key: "item_type", width: 10 },
    { header: "Qty", key: "qty", width: 7, numFmt: NUMBER_FORMAT },
    { header: "Unit price", key: "unit_price", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "Total", key: "total", width: 15, numFmt: CURRENCY_FORMAT },
  ];
  const workbook = new ExcelJS.Workbook();
  const { sheet } = startSheet(workbook, "Report", { title: "Custom Report", subtitle: described, columns });

  rows.forEach((r, i) => {
    const row = sheet.addRow({
      date: new Date(r.invoice_date),
      customer: r.customer_name,
      vehicle: r.vehicle,
      mechanic: r.mechanic_name ?? "",
      description: r.description,
      item_type: TYPE_LABEL[r.item_type] ?? r.item_type,
      qty: r.quantity,
      unit_price: r.unit_price,
      total: r.line_total,
    });
    applyBodyRow(row, i, columns);
  });
  applyTotalRow(sheet.addRow({ date: "Total", customer: `${rows.length} line items`, total: rows.reduce((s, r) => s + r.line_total, 0) }), columns);

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "custom-report.xlsx");
}
