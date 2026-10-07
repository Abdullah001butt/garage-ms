import ExcelJS from "exceljs";
import { computeProfitLoss } from "@/lib/profit-loss";
import { monthLabel } from "@/lib/salary";
import { CURRENCY_FORMAT, SHOP_NAME, XLSX_COLORS, sectionRow, writeTitleBlock } from "@/lib/xlsx-style";

/** A proper income statement layout (not a grid): sections, indented lines, subtotals. */
export async function buildProfitLossWorkbook(month: string) {
  const pl = await computeProfitLoss(month);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet(`P&L ${month}`, {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.6, right: 0.6, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.3 } },
    headerFooter: { oddFooter: `&L&8&K71717A${SHOP_NAME}&R&8&K71717APage &P of &N` },
  });
  sheet.columns = [
    { key: "label", width: 46 },
    { key: "amount", width: 20, style: { numFmt: CURRENCY_FORMAT } },
    { key: "pct", width: 12 },
  ];
  writeTitleBlock(sheet, 3, `Profit & Loss — ${monthLabel(month)}`, `Income statement · ${pl.invoiceCount} invoices`);

  let r = 5;
  const line = (label: string, amount: number, opts: { indent?: boolean; strong?: boolean; tone?: "positive" | "negative"; pct?: string } = {}) => {
    const row = sheet.getRow(r++);
    row.getCell(1).value = label;
    row.getCell(2).value = amount;
    if (opts.pct) row.getCell(3).value = opts.pct;
    row.height = opts.strong ? 20 : 17;
    row.getCell(1).alignment = { indent: opts.indent ? 2 : 0, vertical: "middle" };
    row.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
    const color = opts.tone === "negative" ? XLSX_COLORS.negative : opts.tone === "positive" ? XLSX_COLORS.positive : opts.strong ? XLSX_COLORS.ink : XLSX_COLORS.text;
    for (let c = 1; c <= 3; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 10, bold: !!opts.strong, color: { argb: c === 1 && !opts.strong ? XLSX_COLORS.text : color } };
      if (opts.strong) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.totalFill } };
        cell.border = { top: { style: "thin", color: { argb: XLSX_COLORS.ink } } };
      } else {
        cell.border = { bottom: { style: "hair", color: { argb: XLSX_COLORS.border } } };
      }
    }
  };
  const section = (title: string) => {
    r++;
    sectionRow(sheet, r++, title, 1, 3);
  };

  section("Revenue");
  line("Labour income", pl.laborIncome, { indent: true });
  if (pl.serviceIncome > 0) line("Service income (towing, recovery…)", pl.serviceIncome, { indent: true });
  line("Parts sales", pl.partsRevenue, { indent: true });
  line("Discounts given", -pl.totalDiscount, { indent: true });
  line("Net revenue", pl.netRevenue, { strong: true });

  section("Cost of sales");
  line("Parts cost (COGS)", -pl.partsCost, { indent: true });
  if (pl.subletCosts > 0) line("Sublet / outsourced work", -pl.subletCosts, { indent: true });
  line("Gross profit", pl.grossProfit, { strong: true, pct: `${pl.grossMarginPct.toFixed(1)}%` });

  section("Operating expenses");
  if (pl.expensesByCategory.length === 0) line("No expenses recorded", 0, { indent: true });
  for (const e of pl.expensesByCategory) line(e.category, -e.amount, { indent: true, pct: pl.totalExpenses ? `${Math.round((e.amount / pl.totalExpenses) * 100)}%` : undefined });
  line("Total operating expenses", -pl.totalExpenses, { strong: true });

  r++;
  const net = sheet.getRow(r);
  net.getCell(1).value = "NET PROFIT";
  net.getCell(2).value = pl.netProfit;
  net.getCell(3).value = `${pl.netMarginPct.toFixed(1)}%`;
  net.height = 26;
  for (let c = 1; c <= 3; c++) {
    const cell = net.getCell(c);
    cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: c === 1 ? "FFFFFFFF" : pl.netProfit >= 0 ? "FF6EE7B7" : "FFFCA5A5" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.ink } };
    cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "right", indent: c === 1 ? 1 : 0 };
  }

  if (pl.unlinkedPartsRevenue > 0) {
    const note = sheet.getRow(r + 2);
    note.getCell(1).value = `Note: AED ${pl.unlinkedPartsRevenue.toFixed(2)} of parts sales are not linked to stock items, so their cost is not in COGS.`;
    note.getCell(1).font = { name: "Calibri", size: 9, italic: true, color: { argb: XLSX_COLORS.warning } };
  }

  return workbook;
}
