"use client";

import { Icon } from "@/components/icons";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50 print:hidden"
    >
      <Icon name="printer" className="h-4 w-4 text-zinc-500" />
      {label}
    </button>
  );
}
