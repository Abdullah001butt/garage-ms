"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { findHelpForPath } from "@/lib/help-content";
import { Icon } from "@/components/icons";

export function HelpBanner() {
  const pathname = usePathname();
  const help = findHelpForPath(pathname);
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!help) return;
    const key = `help-dismissed:${pathname}`;
    setDismissed(localStorage.getItem(key) === "1");
    setExpanded(false);
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
      <div className="-mb-3 flex justify-end print:hidden">
        <button
          type="button"
          onClick={reopen}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-700"
        >
          <Icon name="help" className="h-3.5 w-3.5" />
          Page help
        </button>
      </div>
    );
  }

  return (
    <div className="mb-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-600 print:hidden">
      <div className="flex items-start gap-2">
        <Icon name="info" className="mt-0.5 h-4 w-4 text-zinc-400" />
        <div className="min-w-0 flex-1">
          {expanded ? (
            <>
              <p className="font-medium text-zinc-800">{help.title}</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                {help.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="truncate">
              <span className="font-medium text-zinc-800">{help.title}:</span> {help.steps[0]}
            </p>
          )}
        </div>
        {help.steps.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            {expanded ? "Less" : "More"}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="-mr-1 shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Dismiss help"
        >
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
