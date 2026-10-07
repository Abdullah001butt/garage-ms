"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

export type SetupStep = { title: string; detail: string; href: string; done: boolean };

const STORAGE_KEY = "albahir-setup-guide-hidden";

/** "Get set up" checklist: Step 1 → Step N for a new garage. Hides itself once everything is done. */
export function SetupGuide({ steps }: { steps: SetupStep[] }) {
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(true);
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount; storage isn't available on the server
      setHidden(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden || next === -1) return null;

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  }

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Icon name="sparkles" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">Get set up</p>
          <p className="text-xs text-zinc-500 tabular">
            {doneCount} of {steps.length} steps done · next: {steps[next].title}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          aria-expanded={open}
        >
          {open ? "Collapse" : "Show"}
        </button>
        <button type="button" onClick={hide} aria-label="Hide setup guide" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 bg-zinc-100">
        <div className="h-1 bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {open && (
        <ol className="grid divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {steps.map((s, i) => {
            const current = i === next;
            return (
              <li key={s.title} className={`sm:border-b sm:border-zinc-100 ${s.done ? "hidden sm:block" : ""}`}>
                <Link
                  href={s.href}
                  className={`flex h-full items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 ${current ? "bg-brand-50/40" : ""}`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      s.done ? "bg-zinc-900 text-white" : current ? "bg-brand-600 text-white" : "border border-zinc-300 text-zinc-500"
                    }`}
                  >
                    {s.done ? <Icon name="check" className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-medium ${s.done ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{s.title}</span>
                    <span className="block text-xs text-zinc-500">{s.detail}</span>
                  </span>
                  {current && <Icon name="arrow-right" className="ml-auto mt-1 h-4 w-4 shrink-0 text-brand-600" />}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
