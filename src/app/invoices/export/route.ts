import { NextRequest } from "next/server";
import { buildInvoicesWorkbook } from "@/lib/exports/invoices";
import { xlsxResponse } from "@/lib/xlsx-style";

export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter((id) => /^[0-9a-f-]{8,}$/i.test(id));
  const workbook = await buildInvoicesWorkbook(ids.length ? ids : undefined);
  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, ids.length ? "invoices-selection.xlsx" : "invoices.xlsx");
}
