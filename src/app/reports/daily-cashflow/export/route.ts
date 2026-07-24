import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { CURRENCY_FORMAT, xlsxResponse } from "@/lib/xlsx-style";

type PaymentRow = {
  amount: number;
  invoices: {
    customers: { name: string } | null;
    job_cards: {
      description: string;
      vehicles: { plate_number: string } | null;
    } | null;
  } | null;
};

type ExpenseRow = {
  category: string;
  description: string | null;
  amount: number;
};

const IN_HEADER = "FF16A34A"; // green-600
const OUT_HEADER = "FFDC2626"; // red-600
const BORDER = "FFE2E8F0";
const STRIPE = "FFF8FAFC";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  const { data: payments } = await supabase
    .from("payments")
    .select("amount, invoices(customers(name), job_cards(description, vehicles(plate_number)))")
    .gte("paid_at", `${date}T00:00:00`)
    .lte("paid_at", `${date}T23:59:59`)
    .returns<PaymentRow[]>();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("category, description, amount")
    .eq("expense_date", date)
    .returns<ExpenseRow[]>();

  const totalIn = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalOut = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet(`Cash Flow ${date}`, {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  sheet.columns = [
    { key: "a", width: 22 },
    { key: "b", width: 30 },
    { key: "c", width: 14 },
    { key: "d", width: 3 },
    { key: "e", width: 18 },
    { key: "f", width: 26 },
    { key: "g", width: 14 },
  ];

  sheet.mergeCells("A1:C1");
  sheet.mergeCells("E1:G1");
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = `IN — ${date}`;
  titleRow.getCell(5).value = `OUT — ${date}`;
  titleRow.height = 22;
  [1, 5].forEach((col) => {
    const cell = titleRow.getCell(col);
    cell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col === 1 ? IN_HEADER : OUT_HEADER } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const headerRow = sheet.getRow(2);
  headerRow.values = ["Vehicle/Customer", "Job Description", "Amount", "", "Category", "Description", "Amount"];
  [1, 2, 3, 5, 6, 7].forEach((col) => {
    const cell = headerRow.getCell(col);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: col <= 3 ? IN_HEADER : OUT_HEADER },
    };
    cell.alignment = { vertical: "middle", horizontal: col === 3 || col === 7 ? "right" : "left" };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER } },
      bottom: { style: "thin", color: { argb: BORDER } },
      left: { style: "thin", color: { argb: BORDER } },
      right: { style: "thin", color: { argb: BORDER } },
    };
  });
  headerRow.height = 20;

  const maxLen = Math.max(payments?.length ?? 0, expenses?.length ?? 0, 1);
  for (let i = 0; i < maxLen; i++) {
    const p = payments?.[i];
    const e = expenses?.[i];
    const row = sheet.getRow(3 + i);
    row.getCell(1).value = p ? p.invoices?.job_cards?.vehicles?.plate_number ?? p.invoices?.customers?.name ?? "" : "";
    row.getCell(2).value = p ? p.invoices?.job_cards?.description ?? "" : "";
    row.getCell(3).value = p ? Number(p.amount) : null;
    row.getCell(3).numFmt = CURRENCY_FORMAT;
    row.getCell(5).value = e ? e.category : "";
    row.getCell(6).value = e ? e.description ?? "" : "";
    row.getCell(7).value = e ? Number(e.amount) : null;
    row.getCell(7).numFmt = CURRENCY_FORMAT;

    const stripe = i % 2 === 1;
    [1, 2, 3, 5, 6, 7].forEach((col) => {
      const cell = row.getCell(col);
      if (stripe) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE } };
      }
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
    });
  }

  const totalRowIndex = 3 + maxLen;
  const totalRow = sheet.getRow(totalRowIndex);
  totalRow.getCell(2).value = "Total In";
  totalRow.getCell(3).value = totalIn;
  totalRow.getCell(3).numFmt = CURRENCY_FORMAT;
  totalRow.getCell(6).value = "Total Out";
  totalRow.getCell(7).value = totalOut;
  totalRow.getCell(7).numFmt = CURRENCY_FORMAT;
  [2, 3, 6, 7].forEach((col) => {
    const cell = totalRow.getCell(col);
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: col <= 3 ? "FFDCFCE7" : "FFFEE2E2" },
    };
    cell.border = {
      top: { style: "double", color: { argb: col <= 3 ? IN_HEADER : OUT_HEADER } },
    };
  });

  const netRow = sheet.getRow(totalRowIndex + 2);
  netRow.getCell(6).value = "NET";
  netRow.getCell(7).value = totalIn - totalOut;
  netRow.getCell(7).numFmt = CURRENCY_FORMAT;
  netRow.getCell(6).font = { bold: true, size: 12 };
  netRow.getCell(7).font = { bold: true, size: 12, color: { argb: totalIn - totalOut >= 0 ? IN_HEADER : OUT_HEADER } };

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, `cashflow-${date}.xlsx`);
}
