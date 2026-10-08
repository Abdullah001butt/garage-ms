"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { PrimaryButton, SecondaryButton } from "@/components/ui-buttons";
import {
  autoMap,
  cleanEmirate,
  cleanNumber,
  cleanPhone,
  cleanPlate,
  FIELDS,
  nameKey,
  phoneKey,
  plateKey,
  type ImportKind,
} from "@/lib/import-fields";
import { existingKeys, importCustomers, importParts, type ImportResult, type ImportRow } from "@/app/import/actions";

type Sheet = { name: string; headers: string[]; rows: string[][]; truncated?: boolean };
type RowState = { row: number; values: Record<string, string>; status: "new" | "skip" | "problem"; note?: string };

const STEPS = ["What to import", "Upload file", "Check & match", "Import"];
const CHUNK = 200;

const KINDS: { kind: ImportKind; title: string; text: string; icon: IconName }[] = [
  { kind: "customers", title: "Customers & their cars", text: "Names, mobiles, companies and plates — one row per car.", icon: "user" },
  { kind: "parts", title: "Parts stock", text: "Part names, SKUs, stock on hand, cost and selling price.", icon: "package" },
];

/** Excel/CSV → customers, cars or parts, in four steps with a full preview before anything is saved. */
export function ImportWizard() {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<ImportKind>("customers");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [map, setMap] = useState<Record<string, number | null>>({});
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof existingKeys>> | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | RowState["status"]>("all");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fields = FIELDS[kind];
  const sheet = sheets[sheetIdx];

  async function readFile(file: File) {
    setError(null);
    setBusy(true);
    setFileName(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      const [res, keys] = await Promise.all([fetch("/api/import/parse", { method: "POST", body }), existingKeys(kind)]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn’t read the file");
      const list: Sheet[] = json.sheets;
      // Pick the sheet whose columns match the most fields.
      const scored = list.map((s) => Object.values(autoMap(kind, s.headers)).filter((v) => v !== null).length);
      const best = scored.indexOf(Math.max(...scored));
      setSheets(list);
      setSheetIdx(best);
      setMap(autoMap(kind, list[best].headers));
      setExisting(keys);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t read the file");
    } finally {
      setBusy(false);
    }
  }

  const rows: RowState[] = useMemo(() => {
    if (!sheet || !existing) return [];
    const seenPhones = new Set<string>();
    const seenParts = new Set<string>();
    return sheet.rows
      .map((cells, i) => {
        const values: Record<string, string> = {};
        for (const f of fields) values[f.key] = map[f.key] !== null && map[f.key] !== undefined ? (cells[map[f.key]!] ?? "").trim() : "";
        if (kind === "customers" && values.phone) values.phone = cleanPhone(values.phone);
        return { row: i + 2, values };
      })
      .filter((r) => Object.values(r.values).some((v) => v))
      .map((r): RowState => {
        const v = r.values;
        if (kind === "customers") {
          if (!v.name) return { ...r, status: "problem", note: "Missing customer name" };
          const pk = phoneKey(cleanPhone(v.phone));
          if (pk.length < 7) return { ...r, status: "problem", note: "Missing or invalid mobile" };
          const plate = v.plate_number ? cleanPlate(v.plate_number) : null;
          const emirate = cleanEmirate(v.emirate);
          const carNote = v.plate_number && !plate ? "Plate not recognised — car will be skipped" : v.plate_number && !emirate ? "Unknown emirate — car will be skipped" : undefined;
          const known = !!existing.phones?.includes(pk);
          const repeat = seenPhones.has(pk);
          seenPhones.add(pk);
          const carKnown = plate && emirate && !!existing.plates?.includes(plateKey(plate, emirate));
          if (known || repeat) {
            const addsCar = plate && emirate && !carKnown;
            return { ...r, status: addsCar ? "new" : "skip", note: carNote ?? (addsCar ? (known ? "Existing customer — new car added" : "Same mobile as above — car added to that customer") : known ? "Already in the system" : "Duplicate row") };
          }
          return { ...r, status: carNote ? "problem" : "new", note: carNote };
        }
        if (!v.name) return { ...r, status: "problem", note: "Missing part name" };
        for (const k of ["stock_qty", "unit_cost", "unit_price", "reorder_threshold"]) {
          const n = cleanNumber(v[k] ?? "");
          if (Number.isNaN(n) || (n !== null && n < 0)) return { ...r, status: "problem", note: `“${v[k]}” isn’t a number` };
        }
        const key = v.sku ? `sku:${nameKey(v.sku)}` : `name:${nameKey(v.name)}`;
        if (seenParts.has(key)) return { ...r, status: "problem", note: "Same part twice in the file" };
        seenParts.add(key);
        const known = (v.sku && !!existing.skus?.includes(nameKey(v.sku))) || !!existing.names?.includes(nameKey(v.name));
        if (known) return { ...r, status: updateExisting ? "new" : "skip", note: updateExisting ? "Will update the existing part" : "Already in stock list" };
        return { ...r, status: "new" };
      });
  }, [sheet, existing, fields, map, kind, updateExisting]);

  const counts = { all: rows.length, new: rows.filter((r) => r.status === "new").length, skip: rows.filter((r) => r.status === "skip").length, problem: rows.filter((r) => r.status === "problem").length };
  const importable = rows.filter((r) => r.status === "new" || (kind === "customers" && r.status === "problem" && r.note?.includes("car will be skipped"))).length;
  const missingRequired = fields.filter((f) => f.required && (map[f.key] === null || map[f.key] === undefined));
  const shown = rows.filter((r) => filter === "all" || r.status === filter).slice(0, 200);
  const visibleFields = fields.filter((f) => map[f.key] !== null && map[f.key] !== undefined);

  async function runImport() {
    setStep(3);
    setBusy(true);
    setProgress(0);
    const total: ImportResult = { ok: true, created: 0, updated: 0, skipped: 0, vehicles: 0, problems: [] };
    const payload: ImportRow[] = rows.filter((r) => r.status !== "problem" || kind === "customers").map((r) => ({ row: r.row, values: r.values }));
    for (let i = 0; i < payload.length; i += CHUNK) {
      const chunk = payload.slice(i, i + CHUNK);
      const res = kind === "customers" ? await importCustomers(chunk) : await importParts(chunk, updateExisting);
      total.created += res.created;
      total.updated += res.updated;
      total.skipped += res.skipped;
      total.vehicles += res.vehicles;
      total.problems.push(...res.problems);
      if (!res.ok) {
        total.ok = false;
        total.error = res.error;
        break;
      }
      setProgress(Math.min(1, (i + chunk.length) / payload.length));
    }
    if (kind === "parts") total.problems.push(...rows.filter((r) => r.status === "problem").map((r) => ({ row: r.row, message: r.note ?? "Problem" })));
    total.problems.sort((a, b) => a.row - b.row);
    setResult(total);
    setBusy(false);
  }

  function downloadProblems() {
    if (!result) return;
    const csv = ["Row,Problem", ...result.problems.map((p) => `${p.row},"${p.message.replace(/"/g, '""')}"`)].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-problems-${fileName.replace(/\.\w+$/, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep(0);
    setSheets([]);
    setResult(null);
    setError(null);
    setFilter("all");
    setFileName("");
  }

  return (
    <div className="space-y-5">
      {/* stepper */}
      <ol className="flex items-center gap-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {STEPS.map((label, i) => (
          <li key={label} className="flex shrink-0 items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                i < step ? "bg-zinc-900 text-white" : i === step ? "bg-brand-600 text-white ring-4 ring-brand-600/15" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {i < step ? <Icon name="check" className="h-3 w-3" /> : i + 1}
            </span>
            <span className={`text-[13px] font-medium ${i === step ? "text-zinc-900" : "text-zinc-500"}`}>{label}</span>
            {i < STEPS.length - 1 && <span className={`mx-1 h-px w-8 sm:w-14 ${i < step ? "bg-zinc-900" : "bg-zinc-200"}`} />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {KINDS.map((k) => (
            <div key={k.kind} className={`flex flex-col rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${kind === k.kind ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"}`}>
              <button type="button" onClick={() => setKind(k.kind)} className="flex flex-1 items-start gap-4 text-left">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${kind === k.kind ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                  <Icon name={k.icon} className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-zinc-900">{k.title}</span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-zinc-500">{k.text}</span>
                </span>
              </button>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                <a href={`/import/template?kind=${k.kind}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900">
                  <Icon name="download" className="h-4 w-4" />
                  Excel template
                </a>
                <PrimaryButton
                  type="button"
                  onClick={() => {
                    setKind(k.kind);
                    setStep(1);
                  }}
                >
                  Continue
                  <Icon name="arrow-right" className="h-4 w-4" />
                </PrimaryButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) void readFile(f);
            }}
            onClick={() => !busy && inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              drag ? "border-brand-600 bg-brand-50/40" : "border-zinc-300 bg-zinc-50/60 hover:border-zinc-400 hover:bg-zinc-50"
            }`}
          >
            <span className={`flex h-12 w-12 items-center justify-center rounded-full ${busy ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200"}`}>
              {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Icon name="upload" className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{busy ? `Reading ${fileName}…` : "Drop your Excel file here, or click to choose"}</p>
              <p className="mt-1 text-[13px] text-zinc-500">.xlsx or .csv · up to 5,000 rows · nothing is saved until you confirm</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
                e.target.value = "";
              }}
            />
          </div>
          {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700 ring-1 ring-inset ring-red-200">{error}</p>}
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={() => setStep(0)} className="text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
              ← Back
            </button>
            <a href={`/import/template?kind=${kind}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900">
              <Icon name="download" className="h-4 w-4" />
              Don’t have a file? Download the template
            </a>
          </div>
        </div>
      )}

      {step === 2 && sheet && (
        <>
          <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
            {/* column matching */}
            <div className="h-fit rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="border-b border-zinc-200 px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900">Match your columns</p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  <Icon name="sheet" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                  {fileName}
                  {sheets.length > 1 ? "" : ` · ${sheet.name}`}
                </p>
                {sheets.length > 1 && (
                  <select
                    value={sheetIdx}
                    onChange={(e) => {
                      const i = Number(e.target.value);
                      setSheetIdx(i);
                      setMap(autoMap(kind, sheets[i].headers));
                    }}
                    className="mt-2 h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-[13px]"
                  >
                    {sheets.map((s, i) => (
                      <option key={s.name} value={i}>
                        Sheet: {s.name} ({s.rows.length} rows)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <ul className="divide-y divide-zinc-100">
                {fields.map((f, i) => {
                  const col = map[f.key];
                  const groupStart = f.group && f.group !== fields[i - 1]?.group;
                  return (
                    <li key={f.key}>
                      {groupStart && <p className="bg-zinc-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{f.group}</p>}
                      <div className="flex items-center gap-3 px-4 py-2">
                        <span className="w-28 shrink-0">
                          <span className="block text-[13px] font-medium text-zinc-800">
                            {f.label}
                            {f.required && <span className="text-brand-600"> *</span>}
                          </span>
                          {f.hint && <span className="block text-[11px] text-zinc-400">{f.hint}</span>}
                        </span>
                        <select
                          value={col ?? ""}
                          onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                          className={`h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-[13px] ${
                            col === null || col === undefined ? (f.required ? "border-red-300 text-red-700" : "border-zinc-200 text-zinc-400") : "border-zinc-300 text-zinc-900"
                          }`}
                        >
                          <option value="">{f.required ? "Choose a column…" : "— Not in file —"}</option>
                          {sheet.headers.map((h, idx) => (
                            <option key={idx} value={idx}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {kind === "parts" && (
                <label className="flex items-start gap-2.5 border-t border-zinc-200 px-4 py-3 text-[13px] text-zinc-700">
                  <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="mt-0.5 h-4 w-4 accent-zinc-900" />
                  <span>
                    <span className="font-medium text-zinc-900">Update existing parts</span>
                    <span className="block text-xs text-zinc-500">Prices, supplier and stock of parts already in the list are replaced by the file. Stock changes are logged.</span>
                  </span>
                </label>
              )}
            </div>

            {/* preview */}
            <div className="min-w-0 rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3">
                {(
                  [
                    ["all", "All rows", "bg-zinc-100 text-zinc-700"],
                    ["new", kind === "customers" ? "Will be added" : updateExisting ? "Will be added / updated" : "Will be added", "bg-emerald-50 text-emerald-700"],
                    ["skip", "Already there — skipped", "bg-zinc-100 text-zinc-600"],
                    ["problem", "Needs attention", "bg-amber-50 text-amber-800"],
                  ] as const
                ).map(([k, label, tone]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset ${filter === k ? "bg-zinc-900 text-white ring-zinc-900" : `${tone} ring-transparent hover:ring-zinc-300`}`}
                  >
                    {label}
                    <span className="tabular opacity-80">{counts[k]}</span>
                  </button>
                ))}
              </div>
              <div className="max-h-[32rem] overflow-auto">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 z-10 bg-zinc-50 text-left text-xs text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      {visibleFields.map((f) => (
                        <th key={f.key} className="whitespace-nowrap px-3 py-2 font-medium">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {shown.map((r) => (
                      <tr key={r.row} className={r.status === "skip" ? "text-zinc-400" : "text-zinc-800"}>
                        <td className="px-3 py-1.5 text-zinc-400 tabular">{r.row}</td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          <span
                            title={r.note}
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                              r.status === "new" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : r.status === "skip" ? "bg-zinc-50 text-zinc-500 ring-zinc-200" : "bg-amber-50 text-amber-800 ring-amber-200"
                            }`}
                          >
                            {r.status === "new" ? "Add" : r.status === "skip" ? "Skip" : "Check"}
                          </span>
                          {r.note && <span className="ml-2 text-[11px] text-zinc-500">{r.note}</span>}
                        </td>
                        {visibleFields.map((f) => (
                          <td key={f.key} className="max-w-[14rem] truncate whitespace-nowrap px-3 py-1.5">
                            {r.values[f.key] || <span className="text-zinc-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={visibleFields.length + 2} className="px-3 py-10 text-center text-zinc-400">
                          No rows here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(filter === "all" ? rows.length : counts[filter]) > 200 && <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">Showing the first 200 rows. All of them will be imported.</p>}
            </div>
          </div>

          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-zinc-600">
              {missingRequired.length ? (
                <span className="text-red-700">Choose a column for {missingRequired.map((f) => f.label).join(" and ")}.</span>
              ) : (
                <>
                  <span className="font-semibold text-zinc-900">{counts.new}</span> to add{kind === "parts" && updateExisting ? " or update" : ""} ·{" "}
                  <span className="font-semibold text-zinc-900">{counts.skip}</span> skipped · <span className={counts.problem ? "font-semibold text-amber-700" : "font-semibold text-zinc-900"}>{counts.problem}</span> need attention
                  {counts.problem > 0 && kind === "customers" && <span className="text-zinc-500"> (customers in these rows are still added; only bad cars are skipped)</span>}
                </>
              )}
            </p>
            <div className="flex gap-2">
              <SecondaryButton type="button" onClick={() => setStep(1)}>
                Choose another file
              </SecondaryButton>
              <PrimaryButton type="button" disabled={!!missingRequired.length || importable === 0} onClick={runImport}>
                Import {importable} {kind === "customers" ? (importable === 1 ? "row" : "rows") : importable === 1 ? "part" : "parts"}
              </PrimaryButton>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {busy || !result ? (
            <div className="mx-auto max-w-md py-8 text-center">
              <p className="text-sm font-semibold text-zinc-900">Importing…</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${Math.max(4, progress * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-zinc-500 tabular">{Math.round(progress * 100)}%</p>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${result.ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  <Icon name={result.ok ? "check-circle" : "alert"} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-zinc-900">{result.ok ? "Import finished" : "Import stopped"}</p>
                  {result.error && <p className="mt-1 text-[13px] text-red-700">{result.error} — everything before this point was saved.</p>}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
                {[
                  [kind === "customers" ? "Customers added" : "Parts added", result.created],
                  ...(kind === "customers" ? [["Cars added", result.vehicles] as const] : [["Parts updated", result.updated] as const]),
                  ["Already there", result.skipped],
                  ["Problems", result.problems.length],
                ].map(([label, n]) => (
                  <div key={label as string} className="bg-white p-4">
                    <p className="text-xs text-zinc-500">{label}</p>
                    <p className="mt-0.5 text-2xl font-semibold text-zinc-900 tabular">{n}</p>
                  </div>
                ))}
              </div>
              {result.problems.length > 0 && (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/50">
                  <div className="flex items-center justify-between gap-3 border-b border-amber-200 px-4 py-2.5">
                    <p className="text-[13px] font-semibold text-amber-900">Rows that need a look</p>
                    <button type="button" onClick={downloadProblems} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-900 hover:underline">
                      <Icon name="download" className="h-4 w-4" />
                      Download list
                    </button>
                  </div>
                  <ul className="max-h-60 divide-y divide-amber-100 overflow-auto text-[13px]">
                    {result.problems.slice(0, 100).map((p, i) => (
                      <li key={i} className="flex gap-3 px-4 py-1.5">
                        <span className="w-14 shrink-0 text-amber-700 tabular">Row {p.row}</span>
                        <span className="text-zinc-700">{p.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href={kind === "customers" ? "/customers" : "/inventory"} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 text-sm font-medium text-white hover:bg-zinc-800">
                  {kind === "customers" ? "Open customers" : "Open parts stock"}
                  <Icon name="arrow-right" className="h-4 w-4" />
                </Link>
                <SecondaryButton type="button" onClick={reset}>
                  Import another file
                </SecondaryButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
