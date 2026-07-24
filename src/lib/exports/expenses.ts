import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyHeaderRow, applyBodyRow, applyTotalRow, CURRENCY_FORMAT } from "@/lib/xlsx-style";

type ExpenseRow = {
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
};

export async function buildExpensesWorkbook() {
  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("category, description, amount, expense_date")
    .order("expense_date", { ascending: false })
    .returns<ExpenseRow[]>();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet("Expenses", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Category", key: "category", width: 20 },
    { header: "Description", key: "description", width: 34 },
    { header: "Amount", key: "amount", width: 16, style: { numFmt: CURRENCY_FORMAT } },
  ];
  applyHeaderRow(sheet.getRow(1));

  let total = 0;
  (expenses ?? []).forEach((e, i) => {
    total += Number(e.amount);
    const row = sheet.addRow({
      date: new Date(e.expense_date),
      category: e.category,
      description: e.description ?? "",
      amount: Number(e.amount),
    });
    row.getCell("date").numFmt = "dd/mm/yyyy";
    applyBodyRow(row, i);
  });

  const totalRow = sheet.addRow({ date: "", category: "", description: "TOTAL", amount: total });
  applyTotalRow(totalRow);

  return workbook;
}
