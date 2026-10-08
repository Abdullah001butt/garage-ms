import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { applyHeaderRow, XLSX_COLORS, xlsxResponse } from "@/lib/xlsx-style";
import { EMIRATES } from "@/lib/plate";

const TEMPLATES = {
  customers: {
    file: "al-bahir-customers-template.xlsx",
    sheet: "Customers",
    columns: [
      ["Customer name", 28],
      ["Mobile", 16],
      ["Type", 12],
      ["Email", 24],
      ["City", 14],
      ["TRN", 18],
      ["Plate number", 14],
      ["Plate emirate", 16],
      ["Make", 14],
      ["Model", 14],
      ["Year", 8],
      ["Colour", 12],
      ["Notes", 30],
    ] as const,
    examples: [
      ["Omar Al Hashimi", "050 123 4567", "Individual", "", "Ajman", "", "A 21458", "Abu Dhabi", "Lexus", "GS300", "2018", "White", ""],
      ["Gulf Star Logistics LLC", "050 100 2001", "Company", "accounts@gulfstar.ae", "Dubai", "100555666700003", "F 12890", "Dubai", "Mercedes-Benz", "E300", "2013", "Black", "Fleet account"],
      ["Gulf Star Logistics LLC", "050 100 2001", "Company", "", "", "", "D 12345", "Dubai", "Toyota", "Land Cruiser", "2020", "", "Second car — same mobile, same customer"],
    ],
    notes: [
      "One row per car. A customer with three cars = three rows with the same mobile number.",
      "Customer name and Mobile are required. Everything else is optional.",
      "Type: Individual or Company. Leave blank and names with LLC / Trading / Est. are treated as companies.",
      "Plate number like A 12345. Plate emirate blank = Ajman. Short forms work too (DXB, SHJ, AUH…).",
      "Customers whose mobile is already in the system are not added again — their new cars are still added.",
    ],
  },
  parts: {
    file: "al-bahir-parts-template.xlsx",
    sheet: "Parts",
    columns: [
      ["Part name", 30],
      ["SKU", 16],
      ["Stock", 10],
      ["Cost", 12],
      ["Price", 12],
      ["Reorder level", 14],
      ["Supplier", 24],
      ["Supplier phone", 16],
    ] as const,
    examples: [
      ["Engine Oil 5W-30 (1L)", "OIL-5W30-1L", "48", "18", "45", "10", "Mobil Distributor", "04 555 1234"],
      ["Brake Pad Set — Front", "BRK-FR-221", "12", "95", "180", "4", "Al Noor Auto Spare Parts", "06 744 1122"],
    ],
    notes: [
      "Part name is required. Stock blank = 0, reorder level blank = 5.",
      "Cost and Price in AED, numbers only (AED and commas are fine too).",
      "A part already in the system (same SKU, or same name) is skipped — or updated if you tick “Update existing parts”.",
    ],
  },
} as const;

/** A ready-to-fill Excel template (dropdowns for Type and Emirate) plus a "How to fill" sheet with examples. */
export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") === "parts" ? "parts" : "customers";
  const t = TEMPLATES[kind];
  const wb = new ExcelJS.Workbook();
  wb.creator = "Al Bahir Garage";

  const ws = wb.addWorksheet(t.sheet, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  ws.columns = t.columns.map(([header, width]) => ({ header, width }));
  applyHeaderRow(ws.getRow(1));
  const colOf = (h: string) => t.columns.findIndex(([x]) => x === h) + 1;
  const letter = (n: number) => ws.getColumn(n).letter;
  for (let r = 2; r <= 2000; r++) {
    if (kind === "customers") {
      ws.getCell(`${letter(colOf("Type"))}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Individual,Company"'] };
      ws.getCell(`${letter(colOf("Plate emirate"))}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${EMIRATES.join(",")}"`] };
      ws.getCell(`${letter(colOf("Mobile"))}${r}`).numFmt = "@";
    }
  }

  const help = wb.addWorksheet("How to fill", { views: [{ showGridLines: false }] });
  help.columns = t.columns.map(([, width]) => ({ width }));
  help.getCell("A1").value = `How to fill the ${t.sheet} sheet`;
  help.getCell("A1").font = { name: "Calibri", size: 14, bold: true, color: { argb: XLSX_COLORS.ink } };
  t.notes.forEach((n, i) => {
    const c = help.getCell(`A${3 + i}`);
    c.value = `•  ${n}`;
    c.font = { name: "Calibri", size: 10, color: { argb: XLSX_COLORS.text } };
  });
  const start = 4 + t.notes.length;
  help.getCell(`A${start}`).value = "Examples (don’t copy these into your sheet — they are only to show the format)";
  help.getCell(`A${start}`).font = { name: "Calibri", size: 10, bold: true, color: { argb: XLSX_COLORS.muted } };
  const hr = help.getRow(start + 1);
  hr.values = t.columns.map(([h]) => h);
  applyHeaderRow(hr);
  t.examples.forEach((ex, i) => {
    const row = help.getRow(start + 2 + i);
    row.values = [...ex];
    row.eachCell((c) => (c.font = { name: "Calibri", size: 10, italic: true, color: { argb: XLSX_COLORS.muted } }));
  });

  return xlsxResponse(await wb.xlsx.writeBuffer(), t.file);
}
