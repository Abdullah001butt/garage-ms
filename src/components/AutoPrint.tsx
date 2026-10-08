"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Opens the print dialog when the page is visited with ?print=1 (used by the right-click "Print"). */
export function AutoPrint() {
  const params = useSearchParams();
  const wanted = params.get("print") === "1";
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    // Wait for fonts and the logo/QR images so the printout isn't missing anything.
    Promise.all([document.fonts?.ready, ...[...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r)))])
      .then(() => new Promise((r) => setTimeout(r, 400)))
      .then(() => !cancelled && window.print());
    return () => {
      cancelled = true;
    };
  }, [wanted]);
  return null;
}
