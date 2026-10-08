import { finalizeWorkbook } from "@/lib/xlsx-charts";
import { buildExpensesWorkbook } from "@/lib/exports/expenses";
import { xlsxResponse } from "@/lib/xlsx-style";

export async function GET() {
  const workbook = await buildExpensesWorkbook();
  const buffer = await finalizeWorkbook(workbook);
  return xlsxResponse(buffer, "expenses.xlsx");
}
