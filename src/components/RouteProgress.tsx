"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Pending = { from: string; phase: "loading" | "done" };

/**
 * Thin brand-red bar along the top of the screen while moving between
 * pages. Starts when an internal link is clicked; completes as soon as the
 * URL changes (including redirects), then fades away.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentKey = search ? `${pathname}?${search}` : pathname;
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Route handlers that download files (e.g. /customers/export) don't navigate.
      if (/\/export(\/|$)/.test(url.pathname)) return;
      const target = url.search ? `${url.pathname}${url.search}` : url.pathname;
      const here = window.location.search ? `${window.location.pathname}${window.location.search}` : window.location.pathname;
      if (target === here) return;
      setPending({ from: here, phase: "loading" });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The URL changed: finish the bar, then remove it.
  useEffect(() => {
    if (!pending) return;
    if (pending.phase === "loading") {
      if (currentKey === pending.from) return;
      const raf = requestAnimationFrame(() => setPending((p) => (p ? { ...p, phase: "done" } : p)));
      return () => cancelAnimationFrame(raf);
    }
    // "done": let the finishing animation play, then unmount.
    const t = setTimeout(() => setPending(null), 450);
    return () => clearTimeout(t);
  }, [currentKey, pending]);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[2.5px] print:hidden" aria-hidden="true">
      <div
        className={`h-full bg-brand-600 shadow-[0_0_8px_rgba(212,31,49,0.6)] ${
          pending.phase === "loading" ? "route-progress-run" : "route-progress-done"
        }`}
      />
    </div>
  );
}
