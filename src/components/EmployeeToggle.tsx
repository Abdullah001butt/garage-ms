"use client";

import { useEffect, useState } from "react";

const KEY = "albahir-collapsed-companies";

function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Folds a company's employee rows (rendered right under it) in the customers list. Remembered per browser. */
export function EmployeeToggle({ companyId, count }: { companyId: string; count: number }) {
  const [open, setOpen] = useState(true);

  // Apply the remembered state once the rows are on the page.
  useEffect(() => {
    if (readCollapsed().includes(companyId)) apply(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function apply(next: boolean) {
    setOpen(next);
    document.querySelectorAll<HTMLElement>(`tr[data-parent="${CSS.escape(companyId)}"]`).forEach((row) => (row.hidden = !next));
    const company = document.querySelector<HTMLElement>(`tr[data-company="${CSS.escape(companyId)}"]`);
    if (company) company.toggleAttribute("data-folded", !next);
    try {
      const list = new Set(readCollapsed());
      if (next) list.delete(companyId);
      else list.add(companyId);
      localStorage.setItem(KEY, JSON.stringify([...list]));
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={() => apply(!open)}
      aria-expanded={open}
      title={open ? "Hide employees" : "Show employees"}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-zinc-300 hover:text-zinc-900"
    >
      <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {count} employee{count === 1 ? "" : "s"}
    </button>
  );
}
