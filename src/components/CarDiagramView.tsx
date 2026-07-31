import { CarTopViewDiagram } from "@/components/CarTopViewDiagram";
import type { DiagramMarker } from "@/lib/types";

export function CarDiagramView({ markers }: { markers: DiagramMarker[] }) {
  return (
    <div>
      <div className="relative w-full">
        <CarTopViewDiagram />
        {markers.map((m, i) => (
          <span
            key={i}
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            className="absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-2 ring-white"
          >
            {i + 1}
          </span>
        ))}
      </div>
      {markers.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {markers.map((m, i) => (
            <li key={i} className="text-[10px] text-slate-700">
              <span className="font-bold text-red-600">{i + 1}.</span> {m.note || "—"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
