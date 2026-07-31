"use client";

import { useRef, useState } from "react";
import { CarTopViewDiagram } from "@/components/CarTopViewDiagram";
import { inputClass } from "@/components/ui";
import type { DiagramMarker } from "@/lib/types";

export function CarDiagramMarkerInput({ initialMarkers = [] }: { initialMarkers?: DiagramMarker[] }) {
  const [markers, setMarkers] = useState<DiagramMarker[]>(initialMarkers);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMarkers((prev) => [...prev, { x, y, note: "" }]);
  }

  function updateNote(index: number, note: string) {
    setMarkers((prev) => prev.map((m, i) => (i === index ? { ...m, note } : m)));
  }

  function removeMarker(index: number) {
    setMarkers((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <input type="hidden" name="diagram_markers" value={JSON.stringify(markers)} />
      <p className="mb-2 text-xs text-slate-500">Click on the diagram to mark a scratch, dent, or damage spot.</p>
      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative mx-auto w-40 cursor-crosshair select-none rounded-md border border-slate-300 bg-white p-2"
      >
        <CarTopViewDiagram />
        {markers.map((m, i) => (
          <span
            key={i}
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white"
          >
            {i + 1}
          </span>
        ))}
      </div>

      {markers.length > 0 && (
        <div className="mt-3 space-y-2">
          {markers.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {i + 1}
              </span>
              <input
                type="text"
                value={m.note}
                onChange={(e) => updateNote(i, e.target.value)}
                placeholder="e.g. Scratch, Dent, Rust"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeMarker(i)}
                className="shrink-0 text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
