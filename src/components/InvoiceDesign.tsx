"use client";

import { useState, type ComponentProps } from "react";
import { ClassicInvoiceTemplate } from "@/components/ClassicInvoiceTemplate";
import { ModernInvoiceTemplate } from "@/components/ModernInvoiceTemplate";
import { ShowroomInvoiceTemplate } from "@/components/ShowroomInvoiceTemplate";

export type InvoiceStyle = "classic" | "modern" | "showroom";
const STYLES: InvoiceStyle[] = ["classic", "modern", "showroom"];

type Props = Omit<ComponentProps<typeof ShowroomInvoiceTemplate>, "showVat"> & { defaultStyle?: InvoiceStyle };

/** Classic / Modern / Showroom switch above the document. Print and PDF use whichever is showing. */
export function InvoiceDesign({ defaultStyle = "classic", odometer, mechanicName, ...props }: Props) {
  const [style, setStyle] = useState<InvoiceStyle>(defaultStyle);
  const [showVat, setShowVat] = useState(false);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <label className="flex items-center gap-2 text-[13px] text-zinc-600">
          <input type="checkbox" checked={showVat} onChange={(e) => setShowVat(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 accent-zinc-900" />
          Show VAT on printed {props.documentLabel === "ESTIMATE" ? "estimate" : "invoice"}
        </label>
        <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5" role="group" aria-label="Document design">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              aria-pressed={style === s}
              className={`h-7 rounded px-3 text-[12px] font-medium capitalize ${style === s ? "bg-white text-zinc-900 shadow-[0_0_0_1px_rgb(228,228,231)]" : "text-zinc-500 hover:text-zinc-900"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {style === "showroom" ? (
        <ShowroomInvoiceTemplate {...props} odometer={odometer} mechanicName={mechanicName} showVat={showVat} />
      ) : style === "modern" ? (
        <ModernInvoiceTemplate {...props} showVat={showVat} />
      ) : (
        <ClassicInvoiceTemplate {...props} showVat={showVat} />
      )}
    </div>
  );
}
