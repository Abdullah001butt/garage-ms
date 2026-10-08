import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

const MAX_ROWS = 5000;

/** Turns whatever Excel puts in a cell (rich text, formulas, links, dates, numbers) into plain text. */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text);
    if ("error" in v) return "";
    return "";
  }
  return String(v).trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

/** The header is the first row (within the first 15) with at least two text labels — so title blocks above it are skipped. */
function toSheet(name: string, grid: string[][]) {
  const nonEmpty = grid.filter((r) => r.some((c) => c));
  const hi = nonEmpty.slice(0, 15).findIndex((r) => new Set(r.filter((c) => c && isNaN(Number(c)))).size >= 2);
  if (hi < 0) return null;
  const width = Math.max(...nonEmpty.slice(hi).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => nonEmpty[hi][i] || `Column ${i + 1}`);
  const rows = nonEmpty.slice(hi + 1, hi + 1 + MAX_ROWS).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  return { name, headers, rows, truncated: nonEmpty.length - hi - 1 > MAX_ROWS };
}

/** Reads an uploaded .xlsx or .csv and returns its sheets as plain text tables (nothing is saved). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "That file is bigger than 4 MB. Split it into smaller files." }, { status: 400 });

  const lower = file.name.toLowerCase();
  try {
    if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      const text = new TextDecoder().decode(await file.arrayBuffer()).replace(/^﻿/, "");
      const sheet = toSheet(file.name.replace(/\.\w+$/, ""), parseCsv(text));
      if (!sheet) return NextResponse.json({ error: "Couldn’t find a header row in this file." }, { status: 400 });
      return NextResponse.json({ sheets: [sheet] });
    }
    if (!lower.endsWith(".xlsx")) return NextResponse.json({ error: "Please upload an .xlsx or .csv file. (Old .xls files: open them in Excel and Save As .xlsx.)" }, { status: 400 });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const sheets = wb.worksheets
      .filter((ws) => ws.state === "visible" && !/how to fill/i.test(ws.name))
      .map((ws) => {
        const grid: string[][] = [];
        ws.eachRow({ includeEmpty: false }, (row) => {
          const cells: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell, col) => (cells[col - 1] = cellText(cell.value)));
          grid.push(Array.from(cells, (c) => c ?? ""));
        });
        return toSheet(ws.name, grid);
      })
      .filter((s): s is NonNullable<typeof s> => !!s && s.rows.length > 0);
    if (!sheets.length) return NextResponse.json({ error: "This workbook has no rows to import." }, { status: 400 });
    return NextResponse.json({ sheets });
  } catch {
    return NextResponse.json({ error: "Couldn’t read this file. Is it a real Excel (.xlsx) file?" }, { status: 400 });
  }
}
