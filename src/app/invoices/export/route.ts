import { buildInvoicesWorkbook } from "@/lib/exports/invoices";
import { xlsxResponse } from "@/lib/xlsx-style";

export async function GET() {
  const workbook = await buildInvoicesWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "invoices.xlsx");
}
