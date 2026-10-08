import type ExcelJS from "exceljs";
import { addChart, type ChartType } from "@/lib/xlsx-charts";
import { CHART_COLORS, SHOP_NAME, TITLE_FONT, XLSX_COLORS } from "@/lib/xlsx-style";

/**
 * A one-page dashboard sheet in the style of a planner template: big title, a period box,
 * headline figures, lavender-banded panels holding native charts, and tables underneath —
 * all arranged in side-by-side column groups.
 */

type Plain = string | number | Date | null;
/** A value, or a value with its own number format (e.g. a count inside a money column). */
export type Cell = Plain | { v: Plain; fmt: string };
export type DashColumn = { header: string; numFmt?: string; align?: "left" | "right" | "center"; /** In-cell progress bar (values 0–1 or any scale). */ bar?: boolean };
export type DashTable = { title: string; columns: DashColumn[]; rows: Cell[][]; total?: Cell[]; empty?: string; tones?: (("positive" | "negative" | "warning" | "muted") | null)[][] };
export type DashChart = {
  title: string;
  type: ChartType;
  categories: string[];
  series: { name: string; values: number[]; color?: string }[];
  labels?: "percent" | "value" | false;
  legend?: "b" | "r" | "t" | false;
  numFmt?: string;
  pointColors?: string[];
};
export type DashKpi = { label: string; value: number | string; numFmt?: string; note?: string; tone?: "positive" | "negative" | "neutral" };
export type DashGroup = {
  /** Physical column widths for this group (tables in the group use these columns). */
  widths: number[];
  top: { kind: "info"; title: string; rows: [string, Plain, string?][] } | { kind: "chart"; chart: DashChart };
  tables: DashTable[];
};
export type Dashboard = { sheetName?: string; kicker: string; title: string; subtitle?: string; kpis: DashKpi[]; groups: DashGroup[] };

const FONT = "Calibri";
const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const hair = (argb = XLSX_COLORS.border): Partial<ExcelJS.Border> => ({ style: "thin", color: { argb } });
const PANEL_ROWS = 15;

function colLetter(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Hidden sheet holding the numbers the charts point at (so they stay editable in Excel). */
function chartData(workbook: ExcelJS.Workbook) {
  const name = "Chart Data";
  const ws = workbook.getWorksheet(name) ?? workbook.addWorksheet(name, { state: "hidden" });
  return ws;
}

export function buildDashboard(workbook: ExcelJS.Workbook, d: Dashboard) {
  const sheetName = d.sheetName ?? "Dashboard";
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false, zoomScale: 90 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: `&L&8&K8A8798${SHOP_NAME}&R&8&K8A8798Page &P of &N` },
    properties: { tabColor: { argb: XLSX_COLORS.band } },
  });

  // Column plan: margin | group | gutter | group | … | margin
  const starts: number[] = [];
  const widths: number[] = [2.5];
  d.groups.forEach((g, i) => {
    starts.push(widths.length + 1);
    widths.push(...g.widths);
    if (i < d.groups.length - 1) widths.push(2.5);
  });
  widths.push(2.5);
  ws.columns = widths.map((w) => ({ width: w }));
  const lastCol = widths.length;
  const span = (gi: number) => [starts[gi], starts[gi] + d.groups[gi].widths.length - 1] as const;

  let maxRow = 0;
  const touch = (r: number) => (maxRow = Math.max(maxRow, r));
  const merge = (r1: number, c1: number, r2: number, c2: number) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
    touch(r2);
    return ws.getCell(r1, c1);
  };
  const band = (r: number, c1: number, c2: number, text: string) => {
    const cell = merge(r, c1, r, c2);
    cell.value = text.toUpperCase();
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: XLSX_COLORS.bandText } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    for (let c = c1; c <= c2; c++) ws.getCell(r, c).fill = solid(XLSX_COLORS.band);
    ws.getRow(r).height = 24;
  };

  // ── Title area ──
  ws.getRow(1).height = 12;
  const kicker = merge(2, 2, 2, lastCol - 1);
  kicker.value = `${SHOP_NAME}   ·   ${d.kicker.toUpperCase()}`;
  kicker.font = { name: FONT, size: 9, bold: true, color: { argb: XLSX_COLORS.band } };
  const title = merge(3, 2, 3, lastCol - 1);
  title.value = d.title;
  title.font = { name: TITLE_FONT, size: 26, color: { argb: XLSX_COLORS.title } };
  title.alignment = { vertical: "middle" };
  ws.getRow(3).height = 40;
  const sub = merge(4, 2, 4, lastCol - 1);
  sub.value = d.subtitle ?? "";
  sub.font = { name: FONT, size: 9, color: { argb: XLSX_COLORS.muted } };
  ws.getRow(5).height = 10;

  // ── Headline figures: one card per group ──
  d.kpis.slice(0, d.groups.length).forEach((k, i) => {
    const [c1, c2] = span(i);
    const label = merge(6, c1, 6, c2);
    label.value = k.label.toUpperCase();
    label.font = { name: FONT, size: 8, bold: true, color: { argb: XLSX_COLORS.muted } };
    label.alignment = { vertical: "bottom", indent: 1 };
    const value = merge(7, c1, 7, c2);
    value.value = k.value;
    if (k.numFmt) value.numFmt = k.numFmt;
    value.font = { name: FONT, size: 18, bold: true, color: { argb: k.tone === "negative" ? XLSX_COLORS.negative : k.tone === "positive" ? XLSX_COLORS.positive : XLSX_COLORS.ink } };
    value.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    const note = merge(8, c1, 8, c2);
    note.value = k.note ?? "";
    note.font = { name: FONT, size: 8, color: { argb: XLSX_COLORS.muted } };
    note.alignment = { vertical: "top", indent: 1 };
    for (let r = 6; r <= 8; r++)
      for (let c = c1; c <= c2; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = solid("FFFFFFFF");
        cell.border = {
          top: r === 6 ? { style: "medium", color: { argb: XLSX_COLORS.band } } : undefined,
          bottom: r === 8 ? hair() : undefined,
          left: c === c1 ? hair() : undefined,
          right: c === c2 ? hair() : undefined,
        };
      }
  });
  ws.getRow(6).height = 20;
  ws.getRow(7).height = 30;
  ws.getRow(8).height = 18;
  ws.getRow(9).height = 12;

  // ── Panels (info box or chart) ──
  const panelTop = 10;
  const cd = chartData(workbook);
  let cdRow = (cd.lastRow?.number ?? 0) + 1;
  d.groups.forEach((g, gi) => {
    const [c1, c2] = span(gi);
    if (g.top.kind === "info") {
      band(panelTop, c1, c2, g.top.title);
      const mid = c1 + Math.max(0, Math.ceil(g.widths.length / 2) - 1);
      g.top.rows.forEach(([label, value, fmt], i) => {
        const r = panelTop + 1 + i;
        const l = merge(r, c1, r, mid);
        l.value = label.toUpperCase();
        l.font = { name: FONT, size: 8, bold: true, color: { argb: XLSX_COLORS.blushText } };
        l.alignment = { vertical: "middle", horizontal: "center" };
        const v = merge(r, mid + 1, r, c2);
        v.value = value;
        if (fmt) v.numFmt = fmt;
        v.font = { name: FONT, size: 10, color: { argb: XLSX_COLORS.ink } };
        v.alignment = { vertical: "middle", horizontal: "center" };
        for (let c = c1; c <= c2; c++) {
          ws.getCell(r, c).fill = solid(c <= mid ? XLSX_COLORS.totalFill : "FFFFFFFF");
          ws.getCell(r, c).border = { bottom: hair("FFF2E6E4") };
        }
        ws.getRow(r).height = 22;
      });
      // White card for the rest of the panel so it lines up with the charts.
      for (let r = panelTop + 1 + g.top.rows.length; r <= panelTop + PANEL_ROWS; r++) for (let c = c1; c <= c2; c++) ws.getCell(r, c).fill = solid("FFFFFFFF");
      touch(panelTop + PANEL_ROWS);
      return;
    }
    const ch = g.top.chart;
    band(panelTop, c1, c2, ch.title);
    for (let r = panelTop + 1; r <= panelTop + PANEL_ROWS; r++)
      for (let c = c1; c <= c2; c++) {
        ws.getCell(r, c).fill = solid("FFFFFFFF");
        ws.getCell(r, c).border = { left: c === c1 ? hair() : undefined, right: c === c2 ? hair() : undefined, bottom: r === panelTop + PANEL_ROWS ? hair() : undefined };
      }
    touch(panelTop + PANEL_ROWS);
    // Data block on the hidden sheet: categories in A, one column per series.
    const first = cdRow + 1;
    cd.getCell(cdRow, 1).value = ch.title;
    ch.series.forEach((s, si) => (cd.getCell(cdRow, 2 + si).value = s.name));
    ch.categories.forEach((cat, ci) => {
      cd.getCell(first + ci, 1).value = cat;
      ch.series.forEach((s, si) => (cd.getCell(first + ci, 2 + si).value = s.values[ci] ?? 0));
    });
    const last = first + Math.max(ch.categories.length, 1) - 1;
    cdRow = last + 2;
    const ref = (col: number) => `'Chart Data'!$${colLetter(col)}$${first}:$${colLetter(col)}$${last}`;
    addChart(workbook, {
      sheetName,
      type: ch.type,
      from: { col: c1 - 1, row: panelTop },
      to: { col: c2, row: panelTop + PANEL_ROWS },
      categories: { ref: ref(1), values: ch.categories },
      series: ch.series.map((s, si) => ({ name: s.name, ref: ref(2 + si), values: s.values, color: s.color ?? CHART_COLORS[si % CHART_COLORS.length] })),
      pointColors: ch.pointColors ?? (ch.type === "doughnut" || ch.type === "pie" ? CHART_COLORS : undefined),
      labels: ch.labels ?? (ch.type === "doughnut" || ch.type === "pie" ? "percent" : false),
      legend: ch.legend ?? (ch.series.length > 1 || ch.type === "doughnut" || ch.type === "pie" ? "b" : false),
      numFmt: ch.numFmt,
    });
  });

  // ── Tables under each panel ──
  const tablesTop = panelTop + PANEL_ROWS + 2;
  ws.getRow(tablesTop - 1).height = 12;
  d.groups.forEach((g, gi) => {
    const [c1, c2] = span(gi);
    const n = g.widths.length;
    let r = tablesTop;
    for (const t of g.tables) {
      band(r, c1, c2, t.rows.length ? `${t.title}` : t.title);
      r++;
      // Fewer table columns than physical ones: the first column spans the extra.
      const extra = Math.max(0, n - t.columns.length);
      const colRange = (ci: number) => (ci === 0 ? [c1, c1 + extra] : [c1 + extra + ci, c1 + extra + ci]);
      const header = (vals: Cell[], row: number, style: "head" | "body" | "total", idx = 0, tones?: (string | null)[]) => {
        t.columns.forEach((col, ci) => {
          const [a, b] = colRange(ci);
          const cell = merge(row, a, row, b);
          const raw = vals[ci] ?? null;
          const own = raw !== null && typeof raw === "object" && !(raw instanceof Date) ? raw : null;
          cell.value = own ? own.v : (raw as Plain);
          const align = col.align ?? (col.numFmt || col.bar ? "right" : "left");
          if (style === "head") {
            cell.font = { name: FONT, size: 9, bold: true, color: { argb: XLSX_COLORS.blushText } };
            cell.alignment = { vertical: "middle", horizontal: align === "left" ? "left" : align, indent: align === "left" ? 1 : 0, wrapText: true };
          } else {
            if (own) cell.numFmt = own.fmt;
            else if (col.numFmt && typeof raw === "number") cell.numFmt = col.numFmt;
            const tone = tones?.[ci];
            cell.font = {
              name: FONT,
              size: 9,
              bold: style === "total" || !!tone,
              color: { argb: tone ? XLSX_COLORS[tone as "positive"] : style === "total" ? XLSX_COLORS.ink : XLSX_COLORS.text },
            };
            cell.alignment = { vertical: "middle", horizontal: align, indent: align === "left" ? 1 : 0, shrinkToFit: true };
          }
          for (let c = a; c <= b; c++) {
            const x = ws.getCell(row, c);
            x.fill = solid(style === "head" ? XLSX_COLORS.blush : style === "total" ? XLSX_COLORS.totalFill : idx % 2 ? XLSX_COLORS.stripe : "FFFFFFFF");
            x.border = style === "total" ? { top: hair(XLSX_COLORS.band), bottom: { style: "medium", color: { argb: XLSX_COLORS.band } } } : { bottom: hair() };
          }
        });
        ws.getRow(row).height = style === "head" ? 22 : 19;
      };
      header(
        t.columns.map((c) => c.header),
        r++,
        "head"
      );
      const bodyStart = r;
      if (!t.rows.length) {
        const cell = merge(r, c1, r, c2);
        cell.value = t.empty ?? "Nothing to show yet";
        cell.font = { name: FONT, size: 9, italic: true, color: { argb: XLSX_COLORS.muted } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = solid("FFFFFFFF");
        ws.getRow(r).height = 22;
        r++;
      }
      t.rows.forEach((row, i) => header(row, r++, "body", i, t.tones?.[i] ?? undefined));
      const bodyEnd = r - 1;
      if (t.total) header(t.total, r++, "total");
      // In-cell progress bars.
      if (t.rows.length)
        t.columns.forEach((col, ci) => {
          if (!col.bar) return;
          const [a] = colRange(ci);
          ws.addConditionalFormatting({
            ref: `${colLetter(a)}${bodyStart}:${colLetter(a)}${bodyEnd}`,
            rules: [
              {
                type: "dataBar",
                priority: 1,
                gradient: false,
                minLength: 0,
                maxLength: 100,
                cfvo: [{ type: "num", value: 0 }, { type: "max" }],
                color: { argb: "FFC7CCE2" },
              } as unknown as ExcelJS.ConditionalFormattingRule,
            ],
          });
        });
      touch(r);
      r += 1;
    }
  });

  // Soft page colour around the cards.
  for (let r = 1; r <= maxRow + 2; r++)
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      const f = cell.fill as ExcelJS.FillPattern | undefined;
      if (!f || f.type !== "pattern" || !f.fgColor) cell.fill = solid(XLSX_COLORS.page);
    }
  ws.getRow(maxRow + 2).height = 14;
  return ws;
}

/** Share of a total as 0–1 (for % columns and bars). */
export const share = (part: number, total: number) => (total ? part / total : 0);
export const PCT = "0.0%";
export const AED = '"AED" #,##0;[Red]-"AED" #,##0;"–"';
export const AED2 = '"AED" #,##0.00;[Red]-"AED" #,##0.00;"–"';
export const INT = "#,##0;[Red]-#,##0;\"–\"";
