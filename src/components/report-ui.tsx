import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

export type StatItem = {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "default" | "positive" | "negative" | "warning";
  /** % change vs the comparison period; null hides the chip. */
  delta?: number | null;
  /** When true, a fall is good (e.g. expenses), so colours flip. */
  invertDelta?: boolean;
  deltaLabel?: string;
  spark?: number[];
};

const TONE: Record<NonNullable<StatItem["tone"]>, string> = {
  default: "text-zinc-900",
  positive: "text-emerald-700",
  negative: "text-red-700",
  warning: "text-amber-700",
};

/** Tiny trend line drawn on the server (no chart library needed). */
export function Sparkline({ values, className = "", tone = "default" }: { values: number[]; className?: string; tone?: "default" | "positive" | "negative" }) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const stroke = tone === "negative" ? "#dc2626" : tone === "positive" ? "#059669" : "#2a78d6";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`h-7 w-24 ${className}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={stroke} opacity={0.08} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function DeltaChip({ delta, invert = false, label }: { delta: number; invert?: boolean; label?: string }) {
  const good = invert ? delta <= 0 : delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[11px] font-medium tabular ${
        Math.abs(delta) < 0.5 ? "bg-zinc-100 text-zinc-600" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
      title={label}
    >
      {Math.abs(delta) < 0.5 ? "±0%" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta) >= 1000 ? ">999" : Math.abs(delta).toFixed(0)}%`}
      {label && <span className="font-normal opacity-80"> {label}</span>}
    </span>
  );
}

/** One card split into equal columns — the enterprise "metrics strip". Dividers come from a 1px gap. */
export function StatStrip({ items, className = "" }: { items: StatItem[]; className?: string }) {
  const cols = items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  const oddLast = items.length >= 4 ? "lg:[&>*:last-child:nth-child(odd)]:col-span-1" : "sm:[&>*:last-child:nth-child(odd)]:col-span-1";
  return (
    <div
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] [&>*:last-child:nth-child(odd)]:col-span-2 ${oddLast} ${cols} ${className}`}
    >
      {items.map((s) => (
        <div key={s.label} className="min-w-0 bg-white p-4 sm:p-5">
          <p className="truncate text-[13px] font-medium text-zinc-500">{s.label}</p>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p className={`whitespace-nowrap text-xl font-semibold tracking-tight tabular sm:text-2xl ${TONE[s.tone ?? "default"]}`}>{s.value}</p>
            {s.spark && <Sparkline values={s.spark} className="mb-1 hidden shrink-0 xl:block" tone={s.tone === "negative" ? "negative" : "default"} />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            {s.delta !== undefined && s.delta !== null && <DeltaChip delta={s.delta} invert={s.invertDelta} />}
            {s.deltaLabel && s.delta !== undefined && s.delta !== null && <span>{s.deltaLabel}</span>}
            {s.hint && <span className="min-w-0 truncate">{s.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** ‹ October 2026 › — previous / next navigation for monthly or daily reports. */
export function MonthSwitcher({
  label,
  prevHref,
  nextHref,
  thisHref,
  isCurrent,
  thisLabel = "This month",
  children,
}: {
  label: string;
  prevHref: string;
  nextHref: string;
  thisHref?: string;
  isCurrent?: boolean;
  thisLabel?: string;
  /** Optional extra control inside the group (e.g. a date-jump popover). */
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {thisHref && !isCurrent && (
        <Link href={thisHref} className="whitespace-nowrap text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
          {thisLabel}
        </Link>
      )}
      <div className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        <Link href={prevHref} aria-label="Previous" className="flex h-full w-9 items-center justify-center text-zinc-500 hover:text-zinc-900">
          <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
        </Link>
        <span className="flex h-full min-w-[8.5rem] items-center justify-center gap-1.5 whitespace-nowrap border-x border-zinc-200 px-2.5 text-[13px] font-medium text-zinc-800">
          <Icon name="calendar" className="h-3.5 w-3.5 text-zinc-400" />
          {label}
        </span>
        <Link href={nextHref} aria-label="Next" className="flex h-full w-9 items-center justify-center text-zinc-500 hover:text-zinc-900">
          <Icon name="chevron-right" className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </div>
  );
}

/** "Go to date" popover for day-based reports (native <details>, no client JS). */
export function DateJump({ basePath, name = "date", value }: { basePath: string; name?: string; value: string }) {
  return (
    <details className="relative">
      <summary data-plain className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-[13px] font-medium text-zinc-700 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50">
        Go to date
      </summary>
      <form action={basePath} className="absolute right-0 z-30 mt-2 flex w-64 gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
        <input type="date" name={name} defaultValue={value} required className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 px-2 text-[13px]" />
        <button type="submit" className="h-9 rounded-md bg-zinc-900 px-3 text-[13px] font-medium text-white hover:bg-zinc-800">
          Go
        </button>
      </form>
    </details>
  );
}

/** Percentage change, or null when there's nothing to compare against. */
export function pctChange(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}
