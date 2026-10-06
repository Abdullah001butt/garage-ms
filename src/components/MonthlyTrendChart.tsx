"use client";

import { useState } from "react";

export type MonthlyTrendPoint = {
  month: string;
  label: string;
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

  const width = 640;
  const height = 260;
  const padding = { top: 12, right: 8, bottom: 28, left: 52 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxVal = niceMax(Math.max(1, ...data.flatMap((d) => [d.revenue, d.expenses])));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxVal * f));

  const groupWidth = plotW / data.length;
  const barGap = 2;
  const barWidth = Math.min(22, (groupWidth - 24) / 2);
  const scaleH = (v: number) => (Math.max(v, 0) / maxVal) * plotH;

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const tooltipLeftPct = hoveredIndex !== null ? ((padding.left + (hoveredIndex + 0.5) * groupWidth) / width) * 100 : 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-zinc-600">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>

      <div className="relative">
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
                <text x={padding.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#a1a1aa">
                  {tick.toLocaleString("en-US")}
                </text>
              </g>
            );
          })}
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotH}
            y2={padding.top + plotH}
            stroke="#d4d4d8"
            strokeWidth={1}
          />

          {data.map((d, i) => {
            const groupX = padding.left + i * groupWidth;
            const offset = (groupWidth - (barWidth * 2 + barGap)) / 2;
            const isDim = hoveredIndex !== null && hoveredIndex !== i;
            return (
              <g key={d.month} onMouseEnter={() => setHoveredIndex(i)}>
                {/* hit target larger than the marks */}
                <rect x={groupX} y={padding.top} width={groupWidth} height={plotH} fill={hoveredIndex === i ? "#f4f4f5" : "transparent"} />
                {SERIES.map((s, si) => {
                  const h = scaleH(d[s.key]);
                  const x = groupX + offset + si * (barWidth + barGap);
                  return <path key={s.key} d={barPath(x, padding.top + plotH - h, barWidth, h)} fill={s.color} opacity={isDim ? 0.45 : 1} />;
                })}
                <text x={groupX + groupWidth / 2} y={padding.top + plotH + 18} textAnchor="middle" fontSize={11} fill="#71717a">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: `clamp(5.5rem, ${tooltipLeftPct}%, calc(100% - 5.5rem))` }}
          >
            <p className="mb-1.5 font-semibold text-zinc-900">{hovered.label}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="text-zinc-900 tabular">{aed(hovered[s.key])}</span>
              </p>
            ))}
            <p className="mt-1.5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-1.5 text-zinc-600">
              <span>Net</span>
              <span className="font-medium text-zinc-900 tabular">
                {hovered.net < 0 ? "−" : ""}
                {aed(Math.abs(hovered.net))}
              </span>
            </p>
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
    </div>
  );
}
