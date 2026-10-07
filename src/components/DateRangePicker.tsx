import Link from "next/link";
import type { ReactNode } from "react";
import { RANGE_PRESETS, type ResolvedRange } from "@/lib/date-range";
import { Icon } from "@/components/icons";

/**
 * Preset segmented control plus a "Custom" popover (native <details>, so no client JS).
 * `basePath` keeps you on the same page; `extra` carries other query params along.
 */
export function DateRangePicker({
  range,
  basePath,
  extra = {},
  presets = ["week", "month", "last-month", "quarter", "year"],
  children,
}: {
  range: ResolvedRange;
  basePath: string;
  extra?: Record<string, string | undefined>;
  presets?: string[];
  /** Extra controls (e.g. Export) kept on the same row as "Custom". */
  children?: ReactNode;
}) {
  const href = (params: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...extra, ...params })) if (v) q.set(k, v);
    return `${basePath}?${q.toString()}`;
  };
  const shown = RANGE_PRESETS.filter((p) => presets.includes(p.value));

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <div className="inline-flex h-9 max-w-full items-center overflow-x-auto rounded-md border border-zinc-300 bg-white p-0.5 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        {shown.map((p) => {
          const on = range.preset === p.value;
          return (
            <Link
              key={p.value}
              href={href({ range: p.value })}
              aria-current={on ? "true" : undefined}
              className={`flex h-full items-center whitespace-nowrap rounded px-2.5 text-[13px] font-medium transition-colors ${
                on ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
      <details className="relative">
        <summary
          data-plain
          className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-[13px] font-medium shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${
            range.preset === "custom" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <Icon name="calendar" className="h-4 w-4" />
          {range.preset === "custom" ? range.label : "Custom"}
        </summary>
        <form action={basePath} className="absolute left-0 z-30 mt-2 w-72 sm:left-auto sm:right-0 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
          {Object.entries(extra).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <input type="hidden" name="range" value="custom" />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">From</span>
              <input type="date" name="from" defaultValue={range.from} required className="h-9 w-full rounded-md border border-zinc-300 px-2 text-[13px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">To</span>
              <input type="date" name="to" defaultValue={range.to} required className="h-9 w-full rounded-md border border-zinc-300 px-2 text-[13px]" />
            </label>
          </div>
          <button type="submit" className="mt-3 h-9 w-full rounded-md bg-zinc-900 text-[13px] font-medium text-white hover:bg-zinc-800">
            Apply range
          </button>
        </form>
      </details>
      {children}
      </div>
    </div>
  );
}
