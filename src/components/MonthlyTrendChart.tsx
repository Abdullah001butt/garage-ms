"use client";

import { useState } from "react";

export type MonthlyTrendPoint = {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  net: number;
};

const SERIES = [
  { key: "revenue" as const, name: "Revenue", light: "#2a78d6", dark: "#3987e5" },
  { key: "expenses" as const, name: "Expenses", light: "#eb6834", dark: "#d95926" },
  { key: "net" as const, name: "Net", light: "#1baf7a", dark: "#199e70" },
];

function niceMax(value: number) {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const [hovered, setHovered] = useState<{ x: number; y: number; point: MonthlyTrendPoint } | null>(
    null
  );

  const width = 640;
  const height = 280;
  const padding = { top: 16, right: 12, bottom: 28, left: 56 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxVal = niceMax(Math.max(1, ...data.flatMap((d) => [d.revenue, d.expenses, Math.abs(d.net)])));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxVal * f));

  const groupWidth = plotW / data.length;
  const barWidth = Math.min(20, (groupWidth - 16) / 3);
  const barGap = 3;

  const scaleY = (v: number) => plotH - (v / maxVal) * plotH;

  return (
    <div className="viz-root">
      <style>{`
        .viz-root {
          color-scheme: light;
          --surface-1: #ffffff;
          --text-primary: #0b0b0b;
          --text-secondary: #52514e;
          --text-muted: #898781;
          --gridline: #e1e0d9;
          --baseline: #c3c2b7;
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root {
            color-scheme: dark;
            --surface-1: #1a1a19;
            --text-primary: #ffffff;
            --text-secondary: #c3c2b7;
            --text-muted: #898781;
            --gridline: #2c2c2a;
            --baseline: #383835;
          }
        }
        :root[data-theme="dark"] .viz-root {
          color-scheme: dark;
          --surface-1: #1a1a19;
          --text-primary: #ffffff;
          --text-secondary: #c3c2b7;
          --text-muted: #898781;
          --gridline: #2c2c2a;
          --baseline: #383835;
        }
      `}</style>

      <div className="flex items-center gap-4 mb-3 text-xs">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ background: `var(--series-${s.key}, ${s.light})` }}
              data-series={s.key}
            />
            {s.name}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Monthly revenue, expenses, and net profit trend"
      >
        {/* gridlines + y labels */}
        {yTicks.map((tick) => {
          const y = padding.top + scaleY(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--gridline)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--text-muted)"
              >
                {tick.toLocaleString()}
              </text>
            </g>
          );
        })}
        {/* baseline */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotH}
          y2={padding.top + plotH}
          stroke="var(--baseline)"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const groupX = padding.left + i * groupWidth;
          const centerOffset = (groupWidth - (barWidth * 3 + barGap * 2)) / 2;
          return (
            <g key={d.month}>
              {SERIES.map((s, si) => {
                const value = d[s.key];
                const barH = Math.max(0, (Math.abs(value) / maxVal) * plotH);
                const x = groupX + centerOffset + si * (barWidth + barGap);
                const y = padding.top + plotH - barH;
                const isHovered = hovered?.point.month === d.month;
                return (
                  <rect
                    key={s.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={4}
                    fill={s.light}
                    opacity={isHovered ? 1 : 0.92}
                    onMouseEnter={() =>
                      setHovered({ x: x + barWidth / 2, y, point: d })
                    }
                    onMouseLeave={() => setHovered(null)}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}
              <text
                x={groupX + groupWidth / 2}
                y={padding.top + plotH + 18}
                textAnchor="middle"
                fontSize={11}
                fill="var(--text-secondary)"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div className="text-xs rounded-md border border-slate-200 bg-white shadow-md px-3 py-2 mt-1 inline-block">
          <p className="font-semibold text-slate-900 mb-1">{hovered.point.label}</p>
          <p className="text-slate-600">Revenue: AED {hovered.point.revenue.toLocaleString()}</p>
          <p className="text-slate-600">Expenses: AED {hovered.point.expenses.toLocaleString()}</p>
          <p className="text-slate-600">Net: AED {hovered.point.net.toLocaleString()}</p>
        </div>
      )}

      <table className="sr-only">
        <caption>Monthly revenue, expenses, and net profit</caption>
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
