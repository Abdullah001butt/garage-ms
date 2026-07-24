import { buildExpensesWorkbook } from "@/lib/exports/expenses";
import { xlsxResponse } from "@/lib/xlsx-style";

export async function GET() {
  const workbook = await buildExpensesWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, "expenses.xlsx");
}
