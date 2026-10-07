"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatDate } from "@/lib/format";
import type { InvoiceItem, ShopSettings } from "@/lib/types";
import { FitToWidth } from "@/components/FitToWidth";

type Customer = { name: string; phone: string; address: string | null };
type VehicleInfo = { plate_number: string; make: string | null; model: string | null; year: number | null } | null;

const aed = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TYPE_LABEL: Record<string, string> = { part: "Part", labor: "Labour", service: "Service" };

/** Modern, branded invoice/estimate layout. Same data and print/PDF id as the classic one. */
export function ModernInvoiceTemplate({
  documentLabel,
  createdAt,
  items,
  discount,
  vatRate,
  totalPaid,
  settings,
  customer,
  vehicle,
  jobDescription,
  onDeleteItem,
  invoiceNumber,
  showVat,
  qrPath,
  driverName,
}: {
  documentLabel: "INVOICE" | "ESTIMATE";
  createdAt: string;
  items: InvoiceItem[];
  discount: number;
  vatRate: number;
  totalPaid: number;
  settings: ShopSettings | null;
  customer: Customer;
  vehicle: VehicleInfo;
  jobDescription: string | null;
  onDeleteItem: (itemId: string) => void | Promise<void>;
  invoiceNumber?: string | null;
  showVat: boolean;
  /** Site path the QR code opens, e.g. the vehicle's service-history certificate. */
  qrPath?: string | null;
  /** Employee who brought the car when the company is billed. */
  driverName?: string | null;
}) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!qrPath) return;
    QRCode.toDataURL(`${window.location.origin}${qrPath}`, { margin: 0, width: 220, color: { dark: "#18181b", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [qrPath]);

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const vatAmount = showVat ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vatAmount - discount;
  const balance = Math.max(total - totalPaid, 0);
  const isEstimate = documentLabel === "ESTIMATE";
  const title = isEstimate ? "Estimate" : showVat ? "Tax Invoice" : "Invoice";
  const issued = new Date(createdAt);
  const status = isEstimate ? null : balance < 0.01 ? { label: "Paid", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" } : totalPaid > 0 ? { label: "Part paid", cls: "bg-amber-50 text-amber-800 ring-amber-200" } : { label: "Due", cls: "bg-red-50 text-red-700 ring-red-200" };
  const nowMs = new Date().getTime();

  return (
    <FitToWidth width={760}>
      <div id="invoice-printable" className="overflow-hidden rounded-xl border border-zinc-200 bg-white text-[12.5px] leading-snug text-zinc-800 shadow-sm print:rounded-none print:border-none print:shadow-none">
        <div className="h-1.5 bg-brand-600" />
        <div className="p-9 print:p-0 print:pt-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-6">
            <div>
              <img src="/logoalbahir.png" alt="Al Bahir Garage" className="h-14 w-auto object-contain" />
              <p className="mt-3 text-[13px] font-semibold text-zinc-900">{settings?.shop_name ?? "AL BAHIR VEHICLES REPAIR LLC"}</p>
              {settings?.address && <p className="max-w-xs text-zinc-500">{settings.address}</p>}
              <p className="text-zinc-500">{[settings?.phone, settings?.email].filter(Boolean).join(" · ")}</p>
              {settings?.trn && <p className="mt-1 text-zinc-500">TRN {settings.trn}</p>}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">{title}</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-zinc-900">{invoiceNumber ?? "Draft"}</p>
              {status && <span className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${status.cls}`}>{status.label}</span>}
              <dl className="mt-3 space-y-0.5 text-zinc-500">
                <div className="flex justify-end gap-3">
                  <dt>Issued</dt>
                  <dd className="w-28 font-medium text-zinc-900">{formatDate(createdAt)}</dd>
                </div>
                <div className="flex justify-end gap-3">
                  <dt>{isEstimate ? "Valid for" : "Due"}</dt>
                  <dd className="w-28 font-medium text-zinc-900">{isEstimate ? "14 days" : "On receipt"}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Parties */}
          <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200">
            <div className="bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Billed to</p>
              <p className="mt-1.5 font-semibold text-zinc-900">{customer.name}</p>
              <p className="text-zinc-500">{customer.phone}</p>
              {customer.address && <p className="text-zinc-500">{customer.address}</p>}
            </div>
            <div className="bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Vehicle</p>
              {vehicle ? (
                <>
                  <p className="mt-1.5 font-semibold text-zinc-900">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}</p>
                  <p className="text-zinc-500">
                    {vehicle.plate_number}
                    {vehicle.year ? ` · ${vehicle.year}` : ""}
                  </p>
                  {driverName && <p className="text-zinc-500">Driver: {driverName}</p>}
                </>
              ) : (
                <p className="mt-1.5 text-zinc-500">Counter sale</p>
              )}
            </div>
            <div className="bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Work</p>
              <p className="mt-1.5 line-clamp-3 text-zinc-700">{jobDescription || "Parts sale"}</p>
            </div>
          </div>

          {/* Items */}
          <table className="mt-7 w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-zinc-900 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-3">Description</th>
                <th className="w-16 py-2 text-right">Qty</th>
                <th className="w-28 py-2 text-right">Unit price</th>
                <th className="w-28 py-2 text-right">Amount</th>
                <th className="w-12 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const until = item.warranty_days ? new Date(issued.getTime() + item.warranty_days * 86400000) : null;
                return (
                  <tr key={item.id} className="border-b border-zinc-100 align-top">
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-zinc-900">{item.description}</span>
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-px text-[10px] font-medium text-zinc-500">{TYPE_LABEL[item.item_type] ?? item.item_type}</span>
                      {until && (
                        <p className={`mt-0.5 text-[11px] ${until.getTime() > nowMs ? "text-emerald-700" : "text-zinc-400"}`}>
                          {item.warranty_days}-day warranty until {formatDate(until)}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2.5 text-right tabular-nums">{aed(item.unit_price)}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums text-zinc-900">{aed(item.quantity * item.unit_price)}</td>
                    <td className="py-2.5 text-right print:hidden">
                      <button type="button" onClick={() => onDeleteItem(item.id)} className="text-[11px] font-medium text-zinc-400 hover:text-red-600">
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-400">
                    No line items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-5 flex justify-end">
            <dl className="w-72 text-[12.5px]">
              <div className="flex justify-between py-1">
                <dt className="text-zinc-500">Subtotal</dt>
                <dd className="tabular-nums text-zinc-900">{aed(subtotal)}</dd>
              </div>
              {showVat && (
                <div className="flex justify-between py-1">
                  <dt className="text-zinc-500">VAT {vatRate}%</dt>
                  <dd className="tabular-nums text-zinc-900">{aed(vatAmount)}</dd>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between py-1">
                  <dt className="text-zinc-500">Advance / discount</dt>
                  <dd className="tabular-nums text-zinc-900">− {aed(discount)}</dd>
                </div>
              )}
              <div className="mt-1.5 flex items-center justify-between rounded-md bg-zinc-900 px-3 py-2.5 text-white">
                <dt className="text-[13px] font-semibold">Total</dt>
                <dd className="text-base font-semibold tabular-nums">{aed(total)}</dd>
              </div>
              {!isEstimate && (
                <>
                  <div className="flex justify-between px-3 pt-2.5">
                    <dt className="text-zinc-500">Paid</dt>
                    <dd className="tabular-nums text-emerald-700">{aed(totalPaid)}</dd>
                  </div>
                  <div className="flex justify-between px-3 pt-1">
                    <dt className="font-semibold text-zinc-900">Balance due</dt>
                    <dd className={`font-semibold tabular-nums ${balance > 0.01 ? "text-brand-600" : "text-emerald-700"}`}>{aed(balance)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Footer */}
          <div className="mt-9 grid grid-cols-[1fr_auto] gap-6 border-t border-zinc-200 pt-6">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Payment</p>
                <p className="mt-1 text-zinc-700">
                  {settings?.payment_method_note ?? "Cash only"} · Reference <span className="font-mono">{invoiceNumber ?? "—"}</span>
                </p>
                {settings?.payment_instructions && <p className="font-medium text-zinc-900">{settings.payment_instructions}</p>}
              </div>
              {settings?.invoice_disclaimer && <p className="text-[11px] leading-relaxed text-zinc-500">{settings.invoice_disclaimer}</p>}
              <p className="text-[11px] text-zinc-400">Computer-generated document — no signature or stamp required.</p>
            </div>
            {qrPath && (
              <div className="flex w-32 flex-col items-center text-center">
                {qr ? <img src={qr} alt="QR code to this vehicle's service history" className="h-24 w-24" /> : <div className="h-24 w-24 rounded bg-zinc-100" />}
                <p className="mt-1.5 text-[10px] leading-tight text-zinc-500">Scan for this vehicle&apos;s full service history</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-9 py-3 text-[11px] text-zinc-500 print:bg-transparent print:px-0">
          <span>Thank you for choosing {settings?.shop_name ? settings.shop_name.replace(/ LLC$/i, "") : "Al Bahir Garage"}</span>
          <span>{[settings?.website, settings?.phone].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
    </FitToWidth>
  );
}
