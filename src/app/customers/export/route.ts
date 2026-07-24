import { buildCustomersWorkbook } from "@/lib/exports/customers";
import { xlsxResponse } from "@/lib/xlsx-style";

export async function GET() {
  const workbook = await buildCustomersWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "customers.xlsx");
}
