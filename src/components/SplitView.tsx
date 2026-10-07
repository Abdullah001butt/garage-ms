"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PeekPanel, type PeekType } from "@/components/Peek";

const WIDE = "(min-width: 1280px)";
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const INTERACTIVE = "button, input, select, textarea, label, summary, details, [role='menu'], [role='menuitem'], [data-no-split]";

/**
 * Email-style master/detail for a list: on wide screens, rows marked `data-split-id` open in a docked
 * pane instead of navigating. ↑/↓ move through the list, Enter opens the full page, Esc closes the pane.
 */
export function SplitView({ type, storageKey, hrefBase, children }: { type: PeekType; storageKey: string; hrefBase: string; children: ReactNode }) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
  const [on, setOn] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const [selected, setSelected] = useState<string | null>(null);
  const active = wide && on;

  const rowIds = useCallback(() => [...(listRef.current?.querySelectorAll<HTMLElement>("[data-split-id]") ?? [])].map((el) => el.dataset.splitId!), []);

  const select = useCallback((id: string | null, scroll = false) => {
    setSelected(id);
    if (id && scroll) listRef.current?.querySelector(`[data-split-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {}
    if (next && !selected) select(rowIds()[0] ?? null);
    if (!next) setSelected(null);
  }

  // Highlight the selected row.
  useEffect(() => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-split-id]") ?? [];
    rows.forEach((el) => {
      if (active && el.dataset.splitId === selected) el.setAttribute("data-split-active", "");
      else el.removeAttribute("data-split-active");
    });
  }, [active, selected, children]);

  // Keyboard navigation while the pane is open.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role='dialog']")) return;
      const ids = rowIds();
      if (!ids.length) return;
      const i = selected ? ids.indexOf(selected) : -1;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        select(ids[Math.min(ids.length - 1, i + 1)], true);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        select(ids[Math.max(0, i - 1)], true);
      } else if (e.key === "Enter" && selected) {
        e.preventDefault();
        router.push(`${hrefBase}/${selected}`);
      } else if (e.key === "Escape" && selected) {
        setSelected(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, selected, rowIds, select, router, hrefBase]);

  return (
    <div>
      {wide && (
        <div className="mb-2 flex items-center justify-end gap-3">
          {active && <span className="hidden text-xs text-zinc-400 2xl:inline">↑ ↓ to move · Enter to open · Esc to close</span>}
          <button
            type="button"
            onClick={toggle}
            aria-pressed={on}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium shadow-[0_1px_2px_rgba(16,24,40,0.05)] ${
              on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M13 4v16" />
            </svg>
            Split view
          </button>
        </div>
      )}
      <div className={active ? "split-on grid grid-cols-[minmax(0,1fr)_minmax(380px,440px)] items-start gap-4" : ""}>
        <div
          ref={listRef}
          className="min-w-0"
          onClickCapture={(e) => {
            if (!active) return;
            const t = e.target as HTMLElement;
            const row = t.closest<HTMLElement>("[data-split-id]");
            if (!row || t.closest(INTERACTIVE)) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let "open in new tab" work
            e.preventDefault();
            e.stopPropagation();
            select(row.dataset.splitId!);
          }}
        >
          {children}
        </div>
        {active && (
          <aside className="sticky top-[4.5rem] flex h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {selected ? (
              <PeekPanel type={type} id={selected} docked onClose={() => setSelected(null)} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M13 4v16" />
                  </svg>
                </span>
                <p className="text-sm font-medium text-zinc-800">Pick a row to preview it here</p>
                <p className="text-xs text-zinc-500">Use ↑ and ↓ to move through the list.</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
