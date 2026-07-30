"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { findHelpForPath } from "@/lib/help-content";

export function HelpBanner() {
  const pathname = usePathname();
  const help = findHelpForPath(pathname);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!help) return;
    const key = `help-dismissed:${pathname}`;
    setDismissed(localStorage.getItem(key) === "1");
  }, [pathname, help]);

  if (!help) return null;

  function dismiss() {
    localStorage.setItem(`help-dismissed:${pathname}`, "1");
    setDismissed(true);
  }

  function reopen() {
    localStorage.removeItem(`help-dismissed:${pathname}`);
    setDismissed(false);
  }

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={reopen}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 print:hidden"
      >
        ❓ Show help for this page
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 print:hidden">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-indigo-900">❓ How to use: {help.title}</p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-indigo-400 hover:text-indigo-700"
          aria-label="Dismiss help"
        >
          ✕
        </button>
      </div>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-indigo-800">
        {help.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
