import { finalizeWorkbook } from "@/lib/xlsx-charts";
import { NextRequest } from "next/server";
import { buildAttendanceWorkbook } from "@/lib/exports/attendance";
import { xlsxResponse } from "@/lib/xlsx-style";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const workbook = await buildAttendanceWorkbook(month);
  const buffer = await finalizeWorkbook(workbook);
  return xlsxResponse(buffer, `attendance-${month}.xlsx`);
}
