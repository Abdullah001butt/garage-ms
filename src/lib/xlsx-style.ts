import ExcelJS from "exceljs";

// One look for every Excel export: charcoal header, Al Bahir red accent, hairline grid.
export const XLSX_COLORS = {
  ink: "FF18181B", // zinc-900
  text: "FF27272A", // zinc-800
  muted: "FF71717A", // zinc-500
  border: "FFE4E4E7", // zinc-200
  stripe: "FFFAFAFA", // zinc-50
  totalFill: "FFF4F4F5", // zinc-100
  brand: "FFD41F31", // Al Bahir red
  positive: "FF047857", // emerald-700
  negative: "FFB91C1C", // red-700
  warning: "FFB45309", // amber-700
};

export const CURRENCY_FORMAT = '"AED" #,##0.00;[Red]-"AED" #,##0.00;"–"';
export const NUMBER_FORMAT = "#,##0;[Red]-#,##0;\"–\"";
export const DATE_FORMAT = "dd mmm yyyy";
export const SHOP_NAME = "AL BAHIR VEHICLES REPAIR LLC";
const SHOP_LINE = "Shed 1 & 2, Al Sana'a Street, New Industrial Area 2, Ajman, UAE";

const hair = { style: "thin" as const, color: { argb: XLSX_COLORS.border } };
const FONT = "Calibri";

export type SheetColumn = {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
  align?: "left" | "right" | "center";
};

function generatedStamp() {
  return new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  });
}

/**
 * Rows 1–4: report title, company line, period + generated time, red rule.
 * Returns the next free row number (5).
 */
export function writeTitleBlock(sheet: ExcelJS.Worksheet, colCount: number, title: string, subtitle?: string) {
  const last = Math.max(colCount, 4);
  const put = (row: number, value: string, font: Partial<ExcelJS.Font>, height: number) => {
    sheet.mergeCells(row, 1, row, last);
    const cell = sheet.getCell(row, 1);
    cell.value = value;
    cell.font = { name: FONT, ...font };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(row).height = height;
  };
  put(1, title, { size: 16, bold: true, color: { argb: XLSX_COLORS.ink } }, 26);
  put(2, `${SHOP_NAME}  ·  ${SHOP_LINE}`, { size: 9, color: { argb: XLSX_COLORS.muted } }, 15);
  put(3, [subtitle, `Generated ${generatedStamp()}`].filter(Boolean).join("   ·   "), { size: 9, color: { argb: XLSX_COLORS.muted } }, 15);
  for (let c = 1; c <= last; c++) sheet.getCell(3, c).border = { bottom: { style: "medium", color: { argb: XLSX_COLORS.brand } } };
  sheet.getRow(4).height = 8;
  return 5;
}

/** A table sheet: title block, styled header in row 5, frozen + filterable, print-ready. */
export function startSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  opts: { title: string; subtitle?: string; columns: SheetColumn[]; freezeColumns?: number; landscape?: boolean }
) {
  const { columns } = opts;
  const headerRowNumber = 5;
  const sheet = workbook.addWorksheet(name.slice(0, 31), {
    views: [{ state: "frozen", ySplit: headerRowNumber, xSplit: opts.freezeColumns ?? 0, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: opts.landscape ?? columns.length > 6 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 },
      printTitlesRow: `${headerRowNumber}:${headerRowNumber}`,
    },
    headerFooter: { oddFooter: `&L&8&K71717A${SHOP_NAME}&C&8&K71717A${opts.title}&R&8&K71717APage &P of &N` },
  });
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : undefined }));
  workbook.creator = "Al Bahir Garage";

  writeTitleBlock(sheet, columns.length, opts.title, opts.subtitle);

  const header = sheet.getRow(headerRowNumber);
  header.values = columns.map((c) => c.header);
  applyHeaderRow(header, columns);
  sheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: columns.length } };

  return { sheet, columns };
}

function alignFor(col: SheetColumn | undefined): "left" | "right" | "center" {
  if (col?.align) return col.align;
  return col?.numFmt ? "right" : "left";
}

export function applyHeaderRow(row: ExcelJS.Row, columns?: SheetColumn[]) {
  row.eachCell((cell, colNumber) => {
    cell.font = { name: FONT, bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.ink } };
    cell.alignment = { vertical: "middle", horizontal: alignFor(columns?.[colNumber - 1]), wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: XLSX_COLORS.brand } } };
  });
  row.height = 24;
}

export function applyBodyRow(row: ExcelJS.Row, index: number, columns?: SheetColumn[]) {
  row.height = 18;
  const count = columns?.length ?? row.cellCount;
  for (let c = 1; c <= count; c++) {
    const cell = row.getCell(c);
    if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.stripe } };
    cell.border = { bottom: hair };
    cell.font = { name: FONT, size: 10, color: { argb: XLSX_COLORS.text }, ...(cell.font?.bold ? { bold: true } : {}), ...(cell.font?.color ? { color: cell.font.color } : {}) };
    cell.alignment = { vertical: "middle", horizontal: alignFor(columns?.[c - 1]) };
  }
}

export function applyTotalRow(row: ExcelJS.Row, columns?: SheetColumn[]) {
  row.height = 22;
  const count = columns?.length ?? row.cellCount;
  for (let c = 1; c <= count; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT, bold: true, size: 10, color: { argb: XLSX_COLORS.ink } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.totalFill } };
    cell.border = { top: { style: "medium", color: { argb: XLSX_COLORS.ink } }, bottom: { style: "double", color: { argb: XLSX_COLORS.ink } } };
    cell.alignment = { vertical: "middle", horizontal: alignFor(columns?.[c - 1]) };
  }
}

/** Coloured, bold status text (Paid / Unpaid …) inside a body cell. */
export function statusCell(cell: ExcelJS.Cell, tone: "positive" | "negative" | "warning" | "muted") {
  const color = tone === "muted" ? XLSX_COLORS.muted : XLSX_COLORS[tone];
  cell.font = { name: FONT, size: 10, bold: true, color: { argb: color } };
}

/** Section heading row for statement-style sheets (P&L, cash flow). */
export function sectionRow(sheet: ExcelJS.Worksheet, rowNumber: number, text: string, fromCol: number, toCol: number) {
  sheet.mergeCells(rowNumber, fromCol, rowNumber, toCol);
  const cell = sheet.getCell(rowNumber, fromCol);
  cell.value = text.toUpperCase();
  cell.font = { name: FONT, bold: true, size: 9, color: { argb: XLSX_COLORS.muted } };
  cell.alignment = { vertical: "bottom" };
  for (let c = fromCol; c <= toCol; c++) sheet.getCell(rowNumber, c).border = { bottom: { style: "thin", color: { argb: XLSX_COLORS.ink } } };
  sheet.getRow(rowNumber).height = 22;
}

export function xlsxResponse(buffer: ExcelJS.Buffer, filename: string) {
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
