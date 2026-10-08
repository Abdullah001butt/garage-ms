import { finalizeWorkbook } from "@/lib/xlsx-charts";
import { NextRequest } from "next/server";
import { buildProfitLossWorkbook } from "@/lib/exports/profit-loss";
import { xlsxResponse } from "@/lib/xlsx-style";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const workbook = await buildProfitLossWorkbook(month);
  const buffer = await finalizeWorkbook(workbook);
  return xlsxResponse(buffer, `profit-loss-${month}.xlsx`);
}
