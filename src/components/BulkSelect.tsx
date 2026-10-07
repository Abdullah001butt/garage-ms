"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";

type BulkCtx = {
  ids: string[];
  selected: Set<string>;
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
};

const Ctx = createContext<BulkCtx | null>(null);

export function useBulkSelection() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBulkSelection must be used inside <BulkSelectProvider>");
  return ctx;
}

/** Wraps a server-rendered table so its rows can be ticked and acted on together. */
export function BulkSelectProvider({ ids, children }: { ids: string[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const value = useMemo<BulkCtx>(
    () => ({
      ids,
      selected,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      setAll: (on) => setSelected(on ? new Set(ids) : new Set()),
      clear: () => setSelected(new Set()),
    }),
    [ids, selected]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const boxClass = "h-4 w-4 cursor-pointer rounded border-zinc-300 text-zinc-900 accent-zinc-900";

export function SelectAllCheckbox() {
  const { ids, selected, setAll } = useBulkSelection();
  const all = ids.length > 0 && selected.size === ids.length;
  return (
    <input
      type="checkbox"
      aria-label="Select all rows"
      className={boxClass}
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = selected.size > 0 && !all;
      }}
      onChange={(e) => setAll(e.target.checked)}
    />
  );
}

export function RowCheckbox({ id, label }: { id: string; label?: string }) {
  const { selected, toggle } = useBulkSelection();
  return (
    <input
      type="checkbox"
      aria-label={label ? `Select ${label}` : "Select row"}
      className={boxClass}
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/** Floating bar that appears at the bottom while rows are selected. */
export function BulkBar({ children, noun = "row" }: { children: ReactNode; noun?: string }) {
  const { selected, clear } = useBulkSelection();
  if (selected.size === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 print:hidden">
      <div className="pop-in pointer-events-auto flex max-w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-2 pl-4 pr-2 text-white shadow-2xl">
        <span className="whitespace-nowrap text-[13px] font-medium tabular">
          {selected.size} {noun}
          {selected.size === 1 ? "" : "s"} selected
        </span>
        <span className="mx-1 h-5 w-px bg-zinc-700" />
        <div className="flex items-center gap-1.5 overflow-x-auto">{children}</div>
        <button type="button" onClick={clear} aria-label="Clear selection" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export const bulkActionClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-white/10 px-3 text-[13px] font-medium text-white hover:bg-white/20";
