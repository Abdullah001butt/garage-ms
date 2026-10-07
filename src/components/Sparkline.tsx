"use client";

import { useRef, useState } from "react";

/**
 * Tiny trend line. With `labels`, hovering shows a crosshair and the exact value for that day or week.
 */
export function Sparkline({
  values,
  labels,
  unit = "aed",
  className = "",
  tone = "default",
}: {
  values: number[];
  labels?: string[];
  unit?: "aed" | "count";
  className?: string;
  tone?: "default" | "positive" | "negative";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
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
  const fmt = (v: number) => (unit === "aed" ? `AED ${Math.round(v).toLocaleString("en-US")}` : v.toLocaleString("en-US"));
  const interactive = !!labels && labels.length === values.length;

  return (
    <span className={`relative ${className || "inline-block"}`}>
      <svg
        ref={ref}
        viewBox={`0 0 ${w} ${h}`}
        className="h-7 w-24 overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
        onPointerMove={
          interactive
            ? (e) => {
                const r = ref.current!.getBoundingClientRect();
                const i = Math.round(((e.clientX - r.left) / r.width) * (values.length - 1));
                setHover(Math.max(0, Math.min(values.length - 1, i)));
              }
            : undefined
        }
        onPointerLeave={interactive ? () => setHover(null) : undefined}
      >
        <path d={area} fill={stroke} opacity={0.08} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={h} stroke="#a1a1aa" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r={2.5} fill="#fff" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {hover !== null && labels && (
        <span
          className="pointer-events-none absolute top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] shadow-md"
          style={{ left: `${(pts[hover][0] / w) * 100}%` }}
        >
          <span className="font-semibold text-zinc-900 tabular">{fmt(values[hover])}</span>
          <span className="ml-1.5 text-zinc-500">{labels[hover]}</span>
        </span>
      )}
    </span>
  );
}
