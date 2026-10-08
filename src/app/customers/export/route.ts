import { finalizeWorkbook } from "@/lib/xlsx-charts";
import { NextRequest } from "next/server";
import { buildCustomersWorkbook } from "@/lib/exports/customers";
import { xlsxResponse } from "@/lib/xlsx-style";

export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter((id) => /^[0-9a-f-]{8,}$/i.test(id));
  const workbook = await buildCustomersWorkbook(ids.length ? ids : undefined);
  const buffer = await finalizeWorkbook(workbook);
  return xlsxResponse(buffer, ids.length ? "customers-selection.xlsx" : "customers.xlsx");
}
