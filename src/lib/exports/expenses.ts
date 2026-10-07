import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyBodyRow, applyTotalRow, startSheet, CURRENCY_FORMAT, DATE_FORMAT, type SheetColumn } from "@/lib/xlsx-style";

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
  const columns: SheetColumn[] = [
    { header: "Date", key: "date", width: 14, numFmt: DATE_FORMAT },
    { header: "Category", key: "category", width: 22 },
    { header: "Description", key: "description", width: 44 },
    { header: "Amount", key: "amount", width: 18, numFmt: CURRENCY_FORMAT },
  ];
  const { sheet } = startSheet(workbook, "Expenses", { title: "Expenses", subtitle: `${expenses?.length ?? 0} entries`, columns });

  let total = 0;
  (expenses ?? []).forEach((e, i) => {
    total += Number(e.amount);
    const row = sheet.addRow({
      date: new Date(e.expense_date),
      category: e.category,
      description: e.description ?? "",
      amount: Number(e.amount),
    });
    applyBodyRow(row, i, columns);
  });

  const totalRow = sheet.addRow({ date: "Total", category: "", description: `${expenses?.length ?? 0} expenses`, amount: total });
  applyTotalRow(totalRow, columns);

  return workbook;
}
