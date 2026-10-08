import ExcelJS from "exceljs";
import { computeProfitLoss } from "@/lib/profit-loss";
import { monthBounds, monthLabel, shiftMonth } from "@/lib/salary";
import { buildDashboard, share, AED, INT, PCT } from "@/lib/xlsx-dashboard";
import { CURRENCY_FORMAT, SHOP_NAME, XLSX_COLORS, sectionRow, writeTitleBlock } from "@/lib/xlsx-style";

/** A proper income statement layout (not a grid): sections, indented lines, subtotals. */
export async function buildProfitLossWorkbook(month: string) {
  const prevMonth = shiftMonth(month, -1);
  const [pl, prev] = await Promise.all([computeProfitLoss(month), computeProfitLoss(prevMonth)]);
  const prevName = monthLabel(prevMonth).split(" ")[0];
  const chg = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
  const tone = (v: number | null, upGood = true) => (v === null || Math.abs(v) < 0.005 ? null : (v > 0) === upGood ? ("positive" as const) : ("negative" as const));
  const cogs = pl.partsCost + pl.subletCosts;
  const { start, end } = monthBounds(month);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  buildDashboard(workbook, {
    kicker: "Profit & loss",
    title: monthLabel(month),
    subtitle: `Income statement  ·  ${start} to ${end}  ·  All amounts in AED`,
    kpis: [
      { label: "Net revenue", value: pl.netRevenue, numFmt: AED, note: `${pl.invoiceCount} invoices` },
      { label: "Gross profit", value: pl.grossProfit, numFmt: AED, note: `${pl.grossMarginPct.toFixed(1)}% gross margin` },
      { label: "Operating expenses", value: pl.totalExpenses, numFmt: AED, note: `${pl.expensesByCategory.length} categories` },
      { label: "Net profit", value: pl.netProfit, numFmt: AED, tone: pl.netProfit >= 0 ? "positive" : "negative", note: `${pl.netMarginPct.toFixed(1)}% net margin` },
    ],
    groups: [
      {
        widths: [19, 14, 13, 10],
        top: {
          kind: "info",
          title: "Report details",
          rows: [
            ["Month", monthLabel(month)],
            ["Start date", start],
            ["End date", end],
            ["Currency", "AED"],
            ["Invoices", pl.invoiceCount, INT],
            ["Gross margin", pl.grossMarginPct / 100, PCT],
            ["Net margin", pl.netMarginPct / 100, PCT],
          ],
        },
        tables: [
          {
            title: `Compared with ${prevName}`,
            columns: [{ header: "Line" }, { header: "This month", numFmt: AED }, { header: prevName, numFmt: AED }, { header: "Change", numFmt: PCT }],
            rows: [
              ["Net revenue", pl.netRevenue, prev.netRevenue, chg(pl.netRevenue, prev.netRevenue)],
              ["Cost of sales", cogs, prev.partsCost + prev.subletCosts, chg(cogs, prev.partsCost + prev.subletCosts)],
              ["Gross profit", pl.grossProfit, prev.grossProfit, chg(pl.grossProfit, prev.grossProfit)],
              ["Operating expenses", pl.totalExpenses, prev.totalExpenses, chg(pl.totalExpenses, prev.totalExpenses)],
              ["Net profit", pl.netProfit, prev.netProfit, chg(pl.netProfit, prev.netProfit)],
            ],
            tones: [
              [null, null, null, tone(chg(pl.netRevenue, prev.netRevenue))],
              [null, null, null, tone(chg(cogs, prev.partsCost + prev.subletCosts), false)],
              [null, null, null, tone(chg(pl.grossProfit, prev.grossProfit))],
              [null, null, null, tone(chg(pl.totalExpenses, prev.totalExpenses), false)],
              [pl.netProfit >= 0 ? "positive" : "negative", null, null, tone(chg(pl.netProfit, prev.netProfit))],
            ],
          },
        ],
      },
      {
        widths: [20, 13, 11],
        top: {
          kind: "chart",
          chart: { title: "Where revenue came from", type: "doughnut", categories: ["Labour", "Parts", "Services"], series: [{ name: "Revenue", values: [pl.laborIncome, pl.partsRevenue, pl.serviceIncome] }] },
        },
        tables: [
          {
            title: "Revenue",
            columns: [{ header: "Line" }, { header: "Amount", numFmt: AED }, { header: "Share", numFmt: PCT, bar: true }],
            rows: [
              ["Labour income", pl.laborIncome, share(pl.laborIncome, pl.netRevenue + pl.totalDiscount)],
              ["Parts sales", pl.partsRevenue, share(pl.partsRevenue, pl.netRevenue + pl.totalDiscount)],
              ["Service income", pl.serviceIncome, share(pl.serviceIncome, pl.netRevenue + pl.totalDiscount)],
              ["Discounts given", -pl.totalDiscount, null],
            ],
            total: ["Net revenue", pl.netRevenue, null],
          },
        ],
      },
      {
        widths: [20, 13, 11],
        top: {
          kind: "chart",
          chart: {
            title: "Operating expenses",
            type: "doughnut",
            categories: pl.expensesByCategory.slice(0, 7).map((e) => e.category),
            series: [{ name: "Expenses", values: pl.expensesByCategory.slice(0, 7).map((e) => e.amount) }],
          },
        },
        tables: [
          {
            title: "Expenses by category",
            columns: [{ header: "Category" }, { header: "Amount", numFmt: AED }, { header: "Share", numFmt: PCT, bar: true }],
            rows: pl.expensesByCategory.map((e) => [e.category, e.amount, share(e.amount, pl.totalExpenses)]),
            total: ["Total", pl.totalExpenses, pl.totalExpenses ? 1 : 0],
            empty: "No expenses recorded",
          },
        ],
      },
      {
        widths: [18, 13, 13],
        top: {
          kind: "chart",
          chart: {
            title: `This month vs ${prevName}`,
            type: "column",
            categories: ["Revenue", "Gross profit", "Expenses", "Net profit"],
            series: [
              { name: monthLabel(month).split(" ")[0], values: [pl.netRevenue, pl.grossProfit, pl.totalExpenses, pl.netProfit] },
              { name: prevName, values: [prev.netRevenue, prev.grossProfit, prev.totalExpenses, prev.netProfit] },
            ],
          },
        },
        tables: [
          {
            title: "Cost of sales",
            columns: [{ header: "Line" }, { header: "Amount", numFmt: AED }, { header: "Of revenue", numFmt: PCT }],
            rows: [
              ["Parts cost (COGS)", pl.partsCost, share(pl.partsCost, pl.netRevenue)],
              ["Sublet / outsourced", pl.subletCosts, share(pl.subletCosts, pl.netRevenue)],
            ],
            total: ["Gross profit", pl.grossProfit, share(pl.grossProfit, pl.netRevenue)],
          },
        ],
      },
    ],
  });
  const sheet = workbook.addWorksheet("Income statement", {
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
    cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: pl.netProfit >= 0 ? XLSX_COLORS.band : "FFC0675F" } };
    cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "right", indent: c === 1 ? 1 : 0 };
  }

  if (pl.unlinkedPartsRevenue > 0) {
    const note = sheet.getRow(r + 2);
    note.getCell(1).value = `Note: AED ${pl.unlinkedPartsRevenue.toFixed(2)} of parts sales are not linked to stock items, so their cost is not in COGS.`;
    note.getCell(1).font = { name: "Calibri", size: 9, italic: true, color: { argb: XLSX_COLORS.warning } };
  }

  return workbook;
}
