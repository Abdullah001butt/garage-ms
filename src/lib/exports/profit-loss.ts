import ExcelJS from "exceljs";
import { computeProfitLoss } from "@/lib/profit-loss";
import { CURRENCY_FORMAT } from "@/lib/xlsx-style";

export async function buildProfitLossWorkbook(month: string) {
  const pl = await computeProfitLoss(month);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet(`P&L ${month}`);
  sheet.columns = [
    { key: "label", width: 32 },
    { key: "amount", width: 18, style: { numFmt: CURRENCY_FORMAT } },
  ];

  const headerFill = "FF4F46E5";

  function sectionHeader(text: string) {
    const row = sheet.addRow([text]);
    row.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFill } };
    sheet.mergeCells(row.number, 1, row.number, 2);
    row.height = 20;
  }

  function line(label: string, amount: number, opts?: { bold?: boolean; color?: string }) {
    const row = sheet.addRow([label, amount]);
    if (opts?.bold) row.font = { bold: true };
    if (opts?.color) row.getCell(2).font = { ...(row.getCell(2).font ?? {}), color: { argb: opts.color } };
  }

  sectionHeader(`Profit & Loss — ${month}`);
  sheet.addRow([]);

  sectionHeader("Revenue");
  line("Labor Income", pl.laborIncome);
  line("Parts Revenue", pl.partsRevenue);
  line("Parts Cost (COGS)", -pl.partsCost, { color: "FFDC2626" });
  line("Parts Margin", pl.partsMargin, { bold: true });
  line("Discounts Given", -pl.totalDiscount, { color: "FFDC2626" });
  line("Gross Profit", pl.grossProfit, { bold: true });
  sheet.addRow([]);

  sectionHeader("Operating Expenses");
  for (const e of pl.expensesByCategory) {
    line(e.category, e.amount);
  }
  line("Total Expenses", pl.totalExpenses, { bold: true, color: "FFDC2626" });
  sheet.addRow([]);

  sectionHeader("Summary");
  line("Net Revenue", pl.netRevenue, { bold: true });
  line("Net Profit", pl.netProfit, { bold: true, color: pl.netProfit >= 0 ? "FF16A34A" : "FFDC2626" });

  return workbook;
}
