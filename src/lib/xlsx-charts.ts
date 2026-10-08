import type ExcelJS from "exceljs";
import JSZip from "jszip";

/**
 * Native Excel charts for ExcelJS workbooks.
 * ExcelJS can't write charts, so charts are registered on the workbook and spliced into the
 * finished .xlsx (DrawingML chart parts + a drawing per sheet). They open as real, editable Excel
 * charts and import into Google Sheets.
 */

export type ChartType = "doughnut" | "pie" | "column" | "columnStacked" | "bar" | "barStacked" | "line" | "area";

export type ChartSeries = {
  name: string;
  /** Absolute range for the values, e.g. 'Chart Data'!$B$2:$B$7 */
  ref: string;
  values: number[];
  color: string; // RRGGBB
};

export type ChartSpec = {
  sheetName: string;
  type: ChartType;
  /** 0-based anchor cells (top-left inclusive, bottom-right exclusive). */
  from: { col: number; row: number };
  to: { col: number; row: number };
  categories: { ref: string; values: string[] };
  series: ChartSeries[];
  /** Per-slice colours for doughnut/pie. */
  pointColors?: string[];
  legend?: "b" | "r" | "t" | false;
  labels?: "percent" | "value" | false;
  holeSize?: number;
  numFmt?: string;
  gapWidth?: number;
};

const registry = new WeakMap<ExcelJS.Workbook, ChartSpec[]>();

export function addChart(workbook: ExcelJS.Workbook, spec: ChartSpec) {
  const list = registry.get(workbook) ?? [];
  list.push(spec);
  registry.set(workbook, list);
}

const TEXT = "6B6880";
const GRID = "EFE8E7";
const AXIS = "D9D2D1";
const FONT = "Calibri";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fill = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
const txPr = (sz: number, color = TEXT, bold = false) =>
  `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${bold ? 1 : 0}">${fill(color)}<a:latin typeface="${FONT}"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;

function strRef(ref: string, values: string[]) {
  return `<c:strRef><c:f>${esc(ref)}</c:f><c:strCache><c:ptCount val="${values.length}"/>${values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${esc(String(v))}</c:v></c:pt>`)
    .join("")}</c:strCache></c:strRef>`;
}
function numRef(ref: string, values: number[], fmt = "General") {
  return `<c:numRef><c:f>${esc(ref)}</c:f><c:numCache><c:formatCode>${esc(fmt)}</c:formatCode><c:ptCount val="${values.length}"/>${values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${Number.isFinite(v) ? v : 0}</c:v></c:pt>`)
    .join("")}</c:numCache></c:numRef>`;
}

function dLbls(kind: "percent" | "value", fmt: string, pos?: string) {
  return `<c:dLbls>${kind === "value" ? `<c:numFmt formatCode="${esc(fmt)}" sourceLinked="0"/>` : `<c:numFmt formatCode="0%" sourceLinked="0"/>`}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(
    800,
    "3F3D56",
    true
  )}${pos ? `<c:dLblPos val="${pos}"/>` : ""}<c:showLegendKey val="0"/><c:showVal val="${kind === "value" ? 1 : 0}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${
    kind === "percent" ? 1 : 0
  }"/><c:showBubbleSize val="0"/>${kind === "percent" ? `<c:showLeaderLines val="1"/>` : ""}</c:dLbls>`;
}

function axes(horizontal: boolean, numFmt: string, hideValues: boolean) {
  const lineNone = `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>`;
  return (
    `<c:catAx><c:axId val="50010001"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "l" : "b"}"/>` +
    `<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:noFill/><a:ln w="9525">${fill(AXIS)}</a:ln></c:spPr>${txPr(800)}<c:crossAx val="50010002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="50010002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${hideValues ? 1 : 0}"/><c:axPos val="${horizontal ? "b" : "l"}"/>` +
    `<c:majorGridlines><c:spPr><a:ln w="6350">${fill(GRID)}</a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${esc(numFmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `${lineNone}${txPr(800)}<c:crossAx val="50010001"/><c:crosses val="${horizontal ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`
  );
}

function chartXml(spec: ChartSpec) {
  const numFmt = spec.numFmt ?? "#,##0";
  const cat = `<c:cat>${strRef(spec.categories.ref, spec.categories.values)}</c:cat>`;
  const tx = (s: ChartSeries) => `<c:tx><c:v>${esc(s.name)}</c:v></c:tx>`;
  let plot = "";

  if (spec.type === "doughnut" || spec.type === "pie") {
    const s = spec.series[0];
    const colors = spec.pointColors ?? [];
    const pts = spec.categories.values
      .map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(colors[i % Math.max(colors.length, 1)] ?? s.color)}<a:ln w="19050">${fill("FFFFFF")}</a:ln></c:spPr></c:dPt>`)
      .join("");
    const ser = `<c:ser><c:idx val="0"/><c:order val="0"/>${tx(s)}${pts}${spec.labels === false ? "" : dLbls(spec.labels === "value" ? "value" : "percent", numFmt)}${cat}<c:val>${numRef(s.ref, s.values)}</c:val></c:ser>`;
    plot =
      spec.type === "doughnut"
        ? `<c:doughnutChart><c:varyColors val="1"/>${ser}<c:firstSliceAng val="0"/><c:holeSize val="${spec.holeSize ?? 62}"/></c:doughnutChart>`
        : `<c:pieChart><c:varyColors val="1"/>${ser}<c:firstSliceAng val="0"/></c:pieChart>`;
  } else if (spec.type === "line" || spec.type === "area") {
    const isArea = spec.type === "area";
    const sers = spec.series
      .map((s, i) => {
        const sp = isArea
          ? `<c:spPr><a:solidFill><a:srgbClr val="${s.color}"><a:alpha val="45000"/></a:srgbClr></a:solidFill><a:ln w="22225">${fill(s.color)}</a:ln></c:spPr>`
          : `<c:spPr><a:ln w="28575" cap="rnd">${fill(s.color)}<a:round/></a:ln></c:spPr>`;
        const marker = isArea ? "" : `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${fill("FFFFFF")}<a:ln w="15875">${fill(s.color)}</a:ln></c:spPr></c:marker>`;
        return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx(s)}${sp}${marker}${cat}<c:val>${numRef(s.ref, s.values)}</c:val>${isArea ? "" : `<c:smooth val="0"/>`}</c:ser>`;
      })
      .join("");
    plot = isArea
      ? `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:axId val="50010001"/><c:axId val="50010002"/></c:areaChart>${axes(false, numFmt, false)}`
      : `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/><c:axId val="50010001"/><c:axId val="50010002"/></c:lineChart>${axes(false, numFmt, false)}`;
  } else {
    const horizontal = spec.type === "bar" || spec.type === "barStacked";
    const stacked = spec.type === "columnStacked" || spec.type === "barStacked";
    const showVals = spec.labels === "value";
    const sers = spec.series
      .map(
        (s, i) =>
          `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx(s)}<c:spPr>${fill(s.color)}<a:ln><a:noFill/></a:ln></c:spPr><c:invertIfNegative val="0"/>${
            showVals ? dLbls("value", numFmt, stacked ? "ctr" : "outEnd") : ""
          }${cat}<c:val>${numRef(s.ref, s.values)}</c:val></c:ser>`
      )
      .join("");
    plot = `<c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="${stacked ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${sers}<c:gapWidth val="${
      spec.gapWidth ?? (horizontal ? 45 : 70)
    }"/><c:overlap val="${stacked ? 100 : -8}"/><c:axId val="50010001"/><c:axId val="50010002"/></c:barChart>${axes(horizontal, numFmt, horizontal && showVals)}`;
  }

  const legend =
    spec.legend === false
      ? ""
      : `<c:legend><c:legendPos val="${spec.legend ?? "b"}"/><c:overlay val="0"/>${txPr(800)}</c:legend>`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<c:lang val="en-US"/><c:roundedCorners val="0"/>` +
    `<c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>${plot}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900)}` +
    `<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`
  );
}

function anchor(spec: ChartSpec, id: number, relId: string) {
  return (
    `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${spec.from.col}</xdr:col><xdr:colOff>60000</xdr:colOff><xdr:row>${spec.from.row}</xdr:row><xdr:rowOff>60000</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${spec.to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${spec.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id + 1}" name="Chart ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relId}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Writes the workbook and splices in every chart registered with addChart(). */
export async function finalizeWorkbook(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const raw = Buffer.from(await workbook.xlsx.writeBuffer());
  const specs = registry.get(workbook);
  if (!specs?.length) return raw;

  const zip = await JSZip.loadAsync(raw);
  const wbXml = await zip.file("xl/workbook.xml")!.async("string");
  const wbRels = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  let types = await zip.file("[Content_Types].xml")!.async("string");

  const sheetFile = (name: string) => {
    const xmlName = esc(name);
    const m = wbXml.match(new RegExp(`<sheet [^>]*name="${xmlName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*r:id="([^"]+)"`));
    if (!m) return null;
    const t = wbRels.match(new RegExp(`Id="${m[1]}"[^>]*Target="([^"]+)"`)) ?? wbRels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${m[1]}"`));
    return t ? `xl/${t[1].replace(/^\/?xl\//, "")}` : null;
  };

  const bySheet = new Map<string, ChartSpec[]>();
  for (const s of specs) bySheet.set(s.sheetName, [...(bySheet.get(s.sheetName) ?? []), s]);

  let chartNo = 0;
  let drawingNo = 0;
  for (const [sheetName, list] of bySheet) {
    const path = sheetFile(sheetName);
    if (!path || !zip.file(path)) continue;
    drawingNo++;
    const drawingRels: string[] = [];
    const anchors: string[] = [];
    list.forEach((spec, i) => {
      chartNo++;
      zip.file(`xl/charts/chart${chartNo}.xml`, chartXml(spec));
      types = types.replace("</Types>", `<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
      drawingRels.push(`<Relationship Id="rId${i + 1}" Type="${REL}/chart" Target="../charts/chart${chartNo}.xml"/>`);
      anchors.push(anchor(spec, i + 1, `rId${i + 1}`));
    });
    zip.file(
      `xl/drawings/drawing${drawingNo}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join("")}</xdr:wsDr>`
    );
    zip.file(
      `xl/drawings/_rels/drawing${drawingNo}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRels.join("")}</Relationships>`
    );
    types = types.replace("</Types>", `<Override PartName="/xl/drawings/drawing${drawingNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);

    // Link the drawing from the sheet.
    const relsPath = path.replace(/worksheets\/(sheet\d+\.xml)$/, "worksheets/_rels/$1.rels");
    const relId = `rIdChartDrawing${drawingNo}`;
    const relXml = `<Relationship Id="${relId}" Type="${REL}/drawing" Target="../drawings/drawing${drawingNo}.xml"/>`;
    const existing = zip.file(relsPath) ? await zip.file(relsPath)!.async("string") : null;
    zip.file(
      relsPath,
      existing
        ? existing.replace("</Relationships>", `${relXml}</Relationships>`)
        : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relXml}</Relationships>`
    );
    let sheetXml = await zip.file(path)!.async("string");
    const tag = `<drawing r:id="${relId}"/>`;
    const before = ["<legacyDrawing", "<legacyDrawingHF", "<picture", "<oleObjects", "<controls", "<webPublishItems", "<tableParts", "<extLst"]
      .map((t) => sheetXml.indexOf(t))
      .filter((i) => i >= 0);
    const at = before.length ? Math.min(...before) : sheetXml.lastIndexOf("</worksheet>");
    sheetXml = sheetXml.slice(0, at) + tag + sheetXml.slice(at);
    zip.file(path, sheetXml);
  }
  zip.file("[Content_Types].xml", types);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
