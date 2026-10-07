"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

/**
 * Shows a fixed-width document (invoice, report, statement) scaled down to fit
 * narrow screens, like a PDF preview. On wide screens and in print it renders
 * at its natural size. A toggle lets phone users switch to actual size and scroll.
 */
export function FitToWidth({ width, children }: { width: number; children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ available: number; height: number } | null>(null);
  const [actualSize, setActualSize] = useState(false);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => setBox({ available: outer.clientWidth, height: inner.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const scale = box ? Math.min(1, box.available / width) : 1;
  const scaled = scale < 0.999 && !actualSize;

  return (
    <div>
      {box && scale < 0.999 && (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-500 print:hidden">
          <span>{actualSize ? "Actual size — scroll sideways to see all" : "Preview fitted to your screen"}</span>
          <button
            type="button"
            onClick={() => setActualSize((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Icon name={actualSize ? "x" : "search"} className="h-3.5 w-3.5" />
            {actualSize ? "Fit to screen" : "Actual size"}
          </button>
        </div>
      )}
      <div
        ref={outerRef}
        className={`w-full ${scaled ? "overflow-hidden" : "overflow-x-auto"} print:h-auto! print:overflow-visible!`}
        style={scaled && box ? { height: Math.ceil(box.height * scale) } : undefined}
      >
        <div
          ref={innerRef}
          data-fit-inner
          className="origin-top-left print:w-auto! print:transform-none!"
          style={scale < 0.999 ? { width, transform: scaled ? `scale(${scale})` : undefined } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Runs a capture (e.g. html2canvas) with any fit-to-width scaling removed, so PDFs come out full size. */
export async function withNaturalSize<T>(node: HTMLElement, fn: () => Promise<T>): Promise<T> {
  const fit = node.closest<HTMLElement>("[data-fit-inner]");
  const previous = fit?.style.transform ?? "";
  if (fit) fit.style.transform = "none";
  try {
    return await fn();
  } finally {
    if (fit) fit.style.transform = previous;
  }
}
