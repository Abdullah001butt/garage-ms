"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";

export type MonthlyTrendPoint = {
  month: string;
  label: string;
  /** UAE-day bounds of the bar, used for the drill-down. */
  from: string;
  to: string;
  revenue: number;
  expenses: number;
  net: number;
};

// Two categorical series (validated: CVD ΔE 24.7, all six checks pass).
// Net is derived and signed, so it is reported in the tooltip rather than
// drawn as a third bar (a loss month would otherwise look like a gain).
const SERIES = [
  { key: "revenue" as const, name: "Revenue", color: "#2a78d6" },
  { key: "expenses" as const, name: "Expenses", color: "#eb6834" },
];

function niceMax(value: number) {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// Bar with a 4px rounded data-end, square where it meets the baseline.
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function aed(n: number) {
  return `AED ${n.toLocaleString("en-US")}`;
}

export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [open, setOpen] = useState<MonthlyTrendPoint | null>(null);
  const close = useCallback(() => setOpen(null), []);

  // Drawn at the real width of its box, so text stays the same size in a ⅓ or a full-width widget.
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(300, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const height = width > 900 ? 300 : 260;
  const padding = { top: 12, right: 8, bottom: 28, left: 52 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxVal = niceMax(Math.max(1, ...data.flatMap((d) => [d.revenue, d.expenses])));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxVal * f));

  const groupWidth = plotW / data.length;
  const barGap = 2;
  const barWidth = Math.max(6, Math.min(width > 900 ? 30 : 22, (groupWidth - 24) / 2));
  const scaleH = (v: number) => (Math.max(v, 0) / maxVal) * plotH;

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const tooltipLeftPct = hoveredIndex !== null ? ((padding.left + (hoveredIndex + 0.5) * groupWidth) / width) * 100 : 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4 text-xs text-zinc-600">
        <div className="flex items-center gap-4">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
        <span className="hidden text-zinc-400 sm:inline">Click a month to see what’s behind it</span>
      </div>

      <div ref={boxRef} className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label="Monthly revenue and expenses for the last six months"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {yTicks.map((tick) => {
            const y = padding.top + plotH - scaleH(tick);
            return (
              <g key={tick}>
                {tick > 0 && <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#f0f0f1" strokeWidth={1} />}
                <text x={padding.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#a1a1aa">
                  {tick.toLocaleString("en-US")}
                </text>
              </g>
            );
          })}
          <line x1={padding.left} x2={width - padding.right} y1={padding.top + plotH} y2={padding.top + plotH} stroke="#d4d4d8" strokeWidth={1} />

          {data.map((d, i) => {
            const groupX = padding.left + i * groupWidth;
            const offset = (groupWidth - (barWidth * 2 + barGap)) / 2;
            const isHover = hoveredIndex === i;
            const isDim = hoveredIndex !== null && !isHover;
            const cx = groupX + groupWidth / 2;
            return (
              <g
                key={d.month}
                onMouseEnter={() => setHoveredIndex(i)}
                onFocus={() => setHoveredIndex(i)}
                onBlur={() => setHoveredIndex(null)}
                onClick={() => setOpen(d)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(d);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${d.label}: revenue ${aed(d.revenue)}, expenses ${aed(d.expenses)}. Open details`}
                className="cursor-pointer outline-none"
              >
                {/* hit target: the whole column, larger than the marks */}
                <rect x={groupX} y={padding.top} width={groupWidth} height={plotH} rx={6} fill={isHover ? "#f4f4f5" : "transparent"} />
                {/* crosshair */}
                {isHover && <line x1={cx} x2={cx} y1={padding.top} y2={padding.top + plotH} stroke="#a1a1aa" strokeWidth={1} strokeDasharray="3 3" />}
                {SERIES.map((s, si) => {
                  const h = scaleH(d[s.key]);
                  const x = groupX + offset + si * (barWidth + barGap);
                  return (
                    <path
                      key={s.key}
                      d={barPath(x, padding.top + plotH - h, barWidth, h)}
                      fill={s.color}
                      opacity={isDim ? 0.4 : 1}
                      stroke={isHover ? "#ffffff" : "none"}
                      strokeWidth={isHover ? 2 : 0}
                      style={{ transition: "opacity 150ms" }}
                    />
                  );
                })}
                {isHover &&
                  SERIES.map((s, si) => {
                    const h = scaleH(d[s.key]);
                    const x = groupX + offset + si * (barWidth + barGap) + barWidth / 2;
                    return <circle key={s.key} cx={x} cy={padding.top + plotH - h} r={3} fill="#ffffff" stroke={s.color} strokeWidth={2} />;
                  })}
                <text x={cx} y={padding.top + plotH + 18} textAnchor="middle" fontSize={12} fill={isHover ? "#18181b" : "#71717a"} fontWeight={isHover ? 600 : 400}>
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur"
            style={{ left: `clamp(6rem, ${tooltipLeftPct}%, calc(100% - 6rem))` }}
          >
            <p className="mb-1.5 font-medium text-zinc-500">{hovered.label}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-semibold text-zinc-900 tabular">{aed(hovered[s.key])}</span>
              </p>
            ))}
            <p className="mt-1.5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-1.5">
              <span className="text-zinc-500">Net</span>
              <span className={`font-semibold tabular ${hovered.net < 0 ? "text-red-700" : "text-emerald-700"}`}>
                {hovered.net < 0 ? "−" : ""}
                {aed(Math.abs(hovered.net))}
              </span>
            </p>
            <p className="mt-1.5 text-[11px] text-zinc-400">Click for every payment &amp; expense</p>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Monthly revenue, expenses, and net</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Revenue</th>
            <th>Expenses</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{d.label}</td>
              <td>{d.revenue}</td>
              <td>{d.expenses}</td>
              <td>{d.net}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {open && <DrillPanel point={open} onClose={close} />}
    </div>
  );
}

type Drill = {
  payments: { id: string; amount: number; method: string; paid_at: string; invoiceId: string | null; invoiceNumber: string | null; customer: string | null }[];
  expenses: { id: string; amount: number; category: string; description: string | null; date: string }[];
};

const money = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (v: string) => new Date(v.length === 10 ? `${v}T12:00:00+04:00` : v).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dubai" });

/** Side panel listing the payments and expenses behind one bar. */
function DrillPanel({ point, onClose }: { point: MonthlyTrendPoint; onClose: () => void }) {
  const [data, setData] = useState<Drill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"payments" | "expenses">("payments");

  useEffect(() => {
    let alive = true;
    fetch(`/api/drilldown?from=${point.from}&to=${point.to}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Could not load");
        if (alive) setData(json);
      })
      .catch((e) => alive && setError(e.message));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      document.removeEventListener("keydown", onKey);
    };
  }, [point.from, point.to, onClose]);

  const revenue = data ? data.payments.reduce((s, p) => s + p.amount, 0) : point.revenue;
  const spent = data ? data.expenses.reduce((s, e) => s + e.amount, 0) : point.expenses;
  const byCategory = data
    ? [...data.expenses.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount), new Map<string, number>())].sort((a, b) => b[1] - a[1])
    : [];

  return createPortal(
    <div className="fixed inset-0 z-50 print:hidden" role="dialog" aria-modal="true" aria-label={`${point.label} details`}>
      <div className="absolute inset-0 bg-zinc-950/30" onClick={onClose} />
      <aside className="slide-in-right absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start gap-3 px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Behind the numbers</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">{point.label}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200">
            {[
              { label: "Revenue", value: revenue, color: SERIES[0].color },
              { label: "Expenses", value: spent, color: SERIES[1].color },
              { label: "Net", value: revenue - spent, color: null },
            ].map((t) => (
              <div key={t.label} className="bg-white p-3">
                <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                  {t.color && <span className="h-0.5 w-3 rounded-full" style={{ background: t.color }} />}
                  {t.label}
                </p>
                <p className={`mt-0.5 text-sm font-semibold tabular ${t.color ? "text-zinc-900" : t.value < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {t.value < 0 ? "−" : ""}
                  {aed(Math.round(Math.abs(t.value)))}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-1 border-b border-zinc-200 px-5">
          {(["payments", "expenses"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-2.5 pb-2.5 text-[13px] font-medium capitalize ${tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
            >
              {t}
              {data && <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 text-[11px] text-zinc-600 tabular">{t === "payments" ? data.payments.length : data.expenses.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && <p className="m-5 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          {!data && !error && (
            <div className="space-y-2.5 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-10 rounded-md" />
              ))}
            </div>
          )}
          {data && tab === "payments" && (
            <ul className="divide-y divide-zinc-100">
              {data.payments.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-zinc-400">No payments received this month.</li>}
              {data.payments.map((p) => {
                const body = (
                  <>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-zinc-900">{p.customer ?? "Payment"}</span>
                      <span className="block text-xs text-zinc-500">
                        {day(p.paid_at)} · <span className="capitalize">{p.method.replace("_", " ")}</span>
                        {p.invoiceNumber && <span className="font-mono"> · {p.invoiceNumber}</span>}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[13px] font-semibold tabular ${p.amount < 0 ? "text-red-700" : "text-zinc-900"}`}>
                      {p.amount < 0 ? "− " : ""}
                      {money(Math.abs(p.amount))}
                    </span>
                  </>
                );
                return (
                  <li key={p.id}>
                    {p.invoiceId ? (
                      <Link href={`/invoices/${p.invoiceId}`} onClick={onClose} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-zinc-50">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-3 px-5 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {data && tab === "expenses" && (
            <>
              {byCategory.length > 0 && (
                <div className="border-b border-zinc-100 px-5 py-3">
                  <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-zinc-100">
                    {byCategory.map(([cat, v], i) => (
                      <div key={cat} style={{ width: `${(v / (spent || 1)) * 100}%`, background: SERIES[1].color, opacity: 1 - Math.min(i, 4) * 0.18 }} />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                    {byCategory.slice(0, 5).map(([cat, v]) => (
                      <span key={cat}>
                        <span className="capitalize text-zinc-700">{cat}</span> {Math.round((v / (spent || 1)) * 100)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <ul className="divide-y divide-zinc-100">
                {data.expenses.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-zinc-400">No expenses recorded this month.</li>}
                {data.expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium capitalize text-zinc-900">{e.category}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {day(e.date)}
                        {e.description ? ` · ${e.description}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-zinc-900 tabular">{money(e.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3">
          <Link href={`/reports/profit-loss?month=${point.month}`} onClick={onClose} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 text-[13px] font-medium text-white hover:bg-zinc-800">
            Profit &amp; loss for {point.label}
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    </div>,
    document.body
  );
}
