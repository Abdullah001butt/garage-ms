"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { useToast } from "@/components/Toast";
import type { LayoutItem, WidgetSize, WidgetSpec } from "@/lib/dashboard-layout";

export type DashboardWidget = WidgetSpec & { node: ReactNode };

const SPAN: Record<WidgetSize, string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
};
const SIZE_LABEL: Record<WidgetSize, string> = { 2: "⅓", 3: "½", 4: "⅔", 6: "Full" };
const EVENT = "dashboard:customize";

/** Header button that switches the dashboard into edit mode. */
export function CustomizeDashboardButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENT))}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
      Customize
    </button>
  );
}

/**
 * The owner's own dashboard: drag boxes into any order, pick a width, hide or add boxes.
 * Saved per person (user_preferences), so everyone keeps their own layout.
 */
export function DashboardGrid({
  widgets,
  initial,
  defaults,
  save,
}: {
  widgets: DashboardWidget[];
  initial: LayoutItem[];
  defaults: LayoutItem[];
  save: (items: LayoutItem[] | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [snapshot, setSnapshot] = useState<LayoutItem[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, startSaving] = useTransition();
  const { showToast } = useToast();
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const els = useRef(new Map<string, HTMLElement>());
  const before = useRef<Map<string, DOMRect> | null>(null);
  const lastOver = useRef("");

  useEffect(() => {
    const start = () => {
      setSnapshot(items);
      setEditing(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener(EVENT, start);
    return () => window.removeEventListener(EVENT, start);
  }, [items]);

  // FLIP: widgets glide to their new place after a move, resize, hide or add.
  function animate(update: (prev: LayoutItem[]) => LayoutItem[]) {
    const rects = new Map<string, DOMRect>();
    els.current.forEach((el, id) => rects.set(id, el.getBoundingClientRect()));
    before.current = rects;
    setItems(update);
  }
  useLayoutEffect(() => {
    const rects = before.current;
    if (!rects) return;
    before.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    els.current.forEach((el, id) => {
      const a = rects.get(id);
      const b = el.getBoundingClientRect();
      if (!a) {
        el.animate([{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(0.22,1,0.36,1)" });
        return;
      }
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      const sx = a.width / (b.width || 1);
      const sy = a.height / (b.height || 1);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
      el.animate([{ transformOrigin: "top left", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transformOrigin: "top left", transform: "none" }], {
        duration: 320,
        easing: "cubic-bezier(0.22,1,0.36,1)",
      });
    });
  }, [items]);

  const visible = items.filter((i) => !i.hidden && byId.has(i.id));
  const hidden = items.filter((i) => i.hidden && byId.has(i.id));

  const move = (id: string, dir: -1 | 1) =>
    animate((prev) => {
      const order = prev.filter((i) => !i.hidden);
      const idx = order.findIndex((i) => i.id === id);
      const swap = order[idx + dir];
      if (!swap) return prev;
      const next = [...prev];
      const a = next.findIndex((i) => i.id === id);
      const b = next.findIndex((i) => i.id === swap.id);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });

  const dropOn = (targetId: string, after: boolean) => {
    if (!dragId || dragId === targetId) return;
    const key = `${targetId}:${after}`;
    if (lastOver.current === key) return;
    lastOver.current = key;
    animate((prev) => {
      const next = prev.filter((i) => i.id !== dragId);
      const moving = prev.find((i) => i.id === dragId)!;
      const at = next.findIndex((i) => i.id === targetId) + (after ? 1 : 0);
      next.splice(at, 0, moving);
      return next;
    });
  };

  function finish(nextItems: LayoutItem[] | null, message: string) {
    startSaving(async () => {
      const res = await save(nextItems);
      if (!res.ok) {
        showToast(res.error ?? "Could not save the layout", "error");
        return;
      }
      setEditing(false);
      setSnapshot(null);
      setAdding(false);
      showToast(message, "success");
    });
  }

  return (
    <div>
      {editing && (
        <div className="sticky top-16 z-20 mb-4 flex flex-col gap-3 rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-3 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Customizing your dashboard</p>
            <p className="text-xs text-zinc-400">Drag boxes to reorder · pick a width · hide what you don’t need. Only you see this layout.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setAdding((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[13px] font-medium hover:bg-white/15"
              >
                <Icon name="plus" className="h-3.5 w-3.5" />
                Add widget
                {hidden.length > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px] tabular">{hidden.length}</span>}
              </button>
              {adding && (
                <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-2xl">
                  {hidden.length === 0 ? (
                    <p className="px-4 py-5 text-center text-[13px] text-zinc-500">Every widget is already on your dashboard.</p>
                  ) : (
                    <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto">
                      {hidden.map((h) => {
                        const w = byId.get(h.id)!;
                        return (
                          <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium">{w.title}</span>
                              <span className="block text-xs text-zinc-500">{w.description}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                animate((prev) => [...prev.filter((i) => i.id !== h.id), { ...h, hidden: false }])
                              }
                              className="inline-flex h-7 shrink-0 items-center rounded-md bg-zinc-900 px-2.5 text-xs font-medium text-white hover:bg-zinc-800"
                            >
                              Add
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <button type="button" onClick={() => animate(() => defaults)} className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white">
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                if (snapshot) animate(() => snapshot);
                setEditing(false);
                setAdding(false);
              }}
              className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => finish(items, "Dashboard layout saved")}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Done"}
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-zinc-800">Your dashboard is empty</p>
          <p className="mt-1 text-[13px] text-zinc-500">Use Add widget to bring back the boxes you want.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-6">
        {visible.map((item, idx) => {
          const w = byId.get(item.id)!;
          return (
            <section
              key={item.id}
              ref={(el) => {
                if (el) els.current.set(item.id, el);
                else els.current.delete(item.id);
              }}
              className={`@container relative flex min-w-0 flex-col ${SPAN[item.size]} ${dragId === item.id ? "opacity-40" : ""} ${
                editing ? "cursor-grab rounded-xl bg-white/60 p-2 outline-2 outline-dashed outline-offset-2 outline-zinc-300 transition-[outline-color] hover:outline-zinc-500 active:cursor-grabbing" : ""
              }`}
              draggable={editing}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", item.id);
                lastOver.current = "";
                setDragId(item.id);
              }}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const after = item.size === 6 ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
                dropOn(item.id, after);
              }}
              onDrop={(e) => e.preventDefault()}
            >
              {editing && (
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-900 px-2 py-1.5 text-white shadow-md">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-zinc-400" fill="currentColor" aria-hidden="true">
                        {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />))}
                      </svg>
                      <span className="truncate text-xs font-semibold">{w.title}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      {w.sizes.length > 1 && (
                        <span className="flex overflow-hidden rounded-md bg-white/10">
                          {[...w.sizes].sort((a, b) => a - b).map((s) => (
                            <button
                              key={s}
                              type="button"
                              title={`Width ${SIZE_LABEL[s]}`}
                              onClick={() => animate((prev) => prev.map((i) => (i.id === item.id ? { ...i, size: s } : i)))}
                              className={`hidden h-6 min-w-7 px-1.5 text-[11px] font-medium lg:block ${item.size === s ? "bg-white text-zinc-900" : "text-zinc-300 hover:bg-white/15"}`}
                            >
                              {SIZE_LABEL[s]}
                            </button>
                          ))}
                        </span>
                      )}
                      <button type="button" title="Move up" disabled={idx === 0} onClick={() => move(item.id, -1)} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/15 disabled:opacity-30">
                        <Icon name="chevron-right" className="h-3.5 w-3.5 -rotate-90" />
                      </button>
                      <button type="button" title="Move down" disabled={idx === visible.length - 1} onClick={() => move(item.id, 1)} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/15 disabled:opacity-30">
                        <Icon name="chevron-right" className="h-3.5 w-3.5 rotate-90" />
                      </button>
                      <button
                        type="button"
                        title="Hide"
                        onClick={() => animate((prev) => prev.map((i) => (i.id === item.id ? { ...i, hidden: true } : i)))}
                        className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-zinc-300 hover:bg-red-500/80 hover:text-white"
                      >
                        <Icon name="x" className="h-3 w-3" />
                        Hide
                      </button>
                    </span>
                  </div>
                </div>
              )}
              <div className={`min-h-0 flex-1 ${editing ? "pointer-events-none select-none [&_*]:!shadow-none" : ""}`} aria-hidden={editing || undefined}>
                {w.node}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
