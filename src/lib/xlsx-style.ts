import ExcelJS from "exceljs";

export const XLSX_COLORS = {
  headerFill: "FF4F46E5", // indigo-600
  headerText: "FFFFFFFF",
  stripeFill: "FFF8FAFC", // slate-50
  border: "FFE2E8F0", // slate-200
  totalFill: "FFEEF2FF", // indigo-50
  totalText: "FF1E1B4B", // indigo-950
};

export function applyHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: XLSX_COLORS.headerText }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.headerFill } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: XLSX_COLORS.border } },
      bottom: { style: "thin", color: { argb: XLSX_COLORS.border } },
      left: { style: "thin", color: { argb: XLSX_COLORS.border } },
      right: { style: "thin", color: { argb: XLSX_COLORS.border } },
    };
  });
  row.height = 20;
}

export function applyBodyRow(row: ExcelJS.Row, index: number) {
  const stripe = index % 2 === 1;
  row.eachCell((cell) => {
    if (stripe) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.stripeFill } };
    }
    cell.border = {
      top: { style: "thin", color: { argb: XLSX_COLORS.border } },
      bottom: { style: "thin", color: { argb: XLSX_COLORS.border } },
      left: { style: "thin", color: { argb: XLSX_COLORS.border } },
      right: { style: "thin", color: { argb: XLSX_COLORS.border } },
    };
    cell.alignment = { vertical: "middle" };
  });
}

export function applyTotalRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: XLSX_COLORS.totalText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLSX_COLORS.totalFill } };
    cell.border = {
      top: { style: "double", color: { argb: XLSX_COLORS.headerFill } },
      bottom: { style: "thin", color: { argb: XLSX_COLORS.border } },
      left: { style: "thin", color: { argb: XLSX_COLORS.border } },
      right: { style: "thin", color: { argb: XLSX_COLORS.border } },
    };
  });
  row.height = 20;
}

export const CURRENCY_FORMAT = '"AED "#,##0.00';

export function xlsxResponse(buffer: ExcelJS.Buffer, filename: string) {
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
