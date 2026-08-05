"use client";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 print:hidden"
    >
      {label}
    </button>
  );
}
