"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/** One-hue sequential ramp (light → dark blue); the surface-near step means "nothing taken". */
const RAMP = ["#ececee", "#b7d3f6", "#6da7ec", "#2a78d6", "#184f95"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toDate = (k: string) => new Date(`${k}T00:00:00Z`);
const key = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (k: string, n: number) => key(new Date(toDate(k).getTime() + n * 86400000));
const dow = (k: string) => (toDate(k).getUTCDay() + 6) % 7; // Monday = 0
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;
const longDay = (k: string) => toDate(k).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export type HeatmapDay = { amount: number; count: number };

/** A year of takings, one square per day (GitHub-style). Click a day to open its cash flow. */
export function RevenueHeatmap({ days, today }: { days: Record<string, HeatmapDay>; today: string }) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string>(today);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // On narrow screens the year scrolls sideways — start at the most recent weeks.
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [width]);

  const start = useMemo(() => addDays(today, -(52 * 7 + dow(today))), [today]);
  const all = useMemo(() => {
    const out: string[] = [];
    for (let k = start; k <= today; k = addDays(k, 1)) out.push(k);
    return out;
  }, [start, today]);

  // Quantile thresholds over days that took money, so busy and quiet days separate evenly.
  const thresholds = useMemo(() => {
    const vals = all.map((k) => days[k]?.amount ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
    if (!vals.length) return [Infinity, Infinity, Infinity];
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
    return [q(0.25), q(0.5), q(0.75)];
  }, [all, days]);
  const level = (v: number) => (v <= 0 ? 0 : v <= thresholds[0] ? 1 : v <= thresholds[1] ? 2 : v <= thresholds[2] ? 3 : 4);

  const stats = useMemo(() => {
    let total = 0;
    let best: { k: string; v: number } | null = null;
    const byDow = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    let openDays = 0;
    for (const k of all) {
      const v = days[k]?.amount ?? 0;
      total += v;
      if (v > 0) openDays++;
      if (!best || v > best.v) best = { k, v };
      byDow[dow(k)].sum += v;
      byDow[dow(k)].n += 1;
    }
    const avg = byDow.map((d) => (d.n ? d.sum / d.n : 0));
    const topDow = avg.indexOf(Math.max(...avg));
    return { total, best, openDays, topDow, topDowAvg: avg[topDow] };
  }, [all, days]);

  const weeks = Math.ceil(all.length / 7);
  const labelW = 30;
  const gap = 3;
  const cell = Math.max(8, Math.min(24, Math.floor((width - labelW) / weeks) - gap));
  const step = cell + gap;
  const svgW = labelW + weeks * step;
  const svgH = 18 + 7 * step;
  const pos = (k: string) => {
    const i = all.indexOf(k);
    return { x: labelW + Math.floor(i / 7) * step, y: 18 + (i % 7) * step };
  };

  const monthMarks = all
    .map((k, i) => ({ k, i }))
    .filter(({ k, i }) => k.endsWith("-01") || i === 0)
    .map(({ k, i }) => ({ x: labelW + Math.floor(i / 7) * step, label: MONTHS[toDate(k).getUTCMonth()] }))
    .filter((m, i, arr) => i === 0 || m.x - arr[i - 1].x > 24);

  const shown = hover ?? null;
  const tip = shown ? { ...pos(shown), d: days[shown], k: shown } : null;
  const open = (k: string) => router.push(`/reports/daily-cashflow?date=${k}`);

  return (
    <div>
      <div ref={boxRef} className="relative overflow-x-auto">
        <svg
          width={svgW}
          height={svgH}
          role="grid"
          tabIndex={0}
          aria-label={`Daily takings for the last 12 months. ${aed(stats.total)} in total. Use the arrow keys to move between days and Enter to open one.`}
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          onMouseLeave={() => setHover(null)}
          onKeyDown={(e) => {
            const moves: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
            if (moves[e.key] !== undefined) {
              e.preventDefault();
              const next = addDays(focus, moves[e.key]);
              if (next >= start && next <= today) {
                setFocus(next);
                setHover(next);
              }
            } else if (e.key === "Enter") open(focus);
          }}
          onFocus={() => setHover(focus)}
          onBlur={() => setHover(null)}
        >
          <defs>
            <pattern id="hm-closed" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="#f7f7f8" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="#dedee2" strokeWidth="1.5" />
            </pattern>
          </defs>
          {monthMarks.map((m) => (
            <text key={`${m.x}-${m.label}`} x={m.x} y={11} fontSize={10.5} fill="#71717a">
              {m.label}
            </text>
          ))}
          {[0, 2, 4].map((d) => (
            <text key={d} x={0} y={18 + d * step + cell * 0.78} fontSize={10} fill="#a1a1aa">
              {DOW[d]}
            </text>
          ))}
          {all.map((k) => {
            const { x, y } = pos(k);
            const v = days[k]?.amount ?? 0;
            const fri = dow(k) === 4;
            const isHover = k === hover;
            return (
              <rect
                key={k}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx={Math.min(3, cell / 4)}
                fill={v <= 0 && fri ? "url(#hm-closed)" : RAMP[level(v)]}
                stroke={isHover ? "#18181b" : "none"}
                strokeWidth={isHover ? 1.5 : 0}
                className="cursor-pointer"
                onMouseEnter={() => {
                  setHover(k);
                  setFocus(k);
                }}
                onClick={() => open(k)}
              />
            );
          })}
        </svg>
        {tip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={{ left: tip.x + cell / 2, top: tip.y - 6 }}
          >
            <p className="font-semibold text-zinc-900 tabular">{tip.d?.amount ? aed(tip.d.amount) : dow(tip.k) === 4 ? "Closed (Friday)" : "No takings"}</p>
            <p className="text-zinc-500">
              {longDay(tip.k)}
              {tip.d?.count ? ` · ${tip.d.count} payment${tip.d.count > 1 ? "s" : ""}` : ""}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <Stat label="Last 12 months" value={aed(stats.total)} />
          {stats.best && stats.best.v > 0 && <Stat label="Best day" value={aed(stats.best.v)} hint={longDay(stats.best.k)} />}
          {stats.topDowAvg > 0 && <Stat label="Busiest weekday" value={DOW[stats.topDow]} hint={`${aed(stats.topDowAvg)} on average`} />}
          <Stat label="Days with takings" value={String(stats.openDays)} />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>Less</span>
          {RAMP.map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
          ))}
          <span>More</span>
          <span className="ml-3 h-2.5 w-2.5 rounded-[3px] border border-zinc-200" style={{ background: "repeating-linear-gradient(45deg,#f7f7f8 0 2px,#dedee2 2px 3px)" }} />
          <span>Friday · closed</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="font-semibold text-zinc-900 tabular">{value}</p>
      {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}
