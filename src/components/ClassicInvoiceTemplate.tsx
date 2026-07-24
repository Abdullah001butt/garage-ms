"use client";

import { useState } from "react";
import type { InvoiceItem, ShopSettings } from "@/lib/types";

type Customer = {
  name: string;
  phone: string;
  address: string | null;
};

type VehicleInfo = {
  plate_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
} | null;

function formatReference(createdAt: string) {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

export function ClassicInvoiceTemplate({
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
}) {
  const [showVat, setShowVat] = useState(false);

  const date = new Date(createdAt);
  const reference = formatReference(createdAt);
  const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const vatAmount = showVat ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vatAmount - discount;
  const remainingBalance = Math.max(total - totalPaid, 0);

  const MIN_ROWS = 7;
  const paddingRows = Math.max(0, MIN_ROWS - items.length);

  const vehicleLine = vehicle
    ? `${[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ")} [${vehicle.plate_number}]`
    : null;

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-slate-600 mb-4 print:hidden">
        <input
          type="checkbox"
          checked={showVat}
          onChange={(e) => setShowVat(e.target.checked)}
          className="rounded border-slate-300"
        />
        Show VAT on printed invoice
      </label>

      <div className="bg-white text-black p-8 font-sans text-[13px] leading-snug print:p-0 rounded-xl border border-slate-200 shadow-sm print:border-none print:shadow-none">
        <div className="flex items-start justify-between border-b-4 border-black pb-3 mb-4">
          <h1 className="font-serif text-3xl">
            {documentLabel} <span className="text-red-600">{reference}</span>
          </h1>
          <img src="/logoalbahir.png" alt="Al Bahir Garage" className="h-16 object-contain" />
        </div>

        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="inline-block border-b border-red-200 pb-1 mb-1">
              {dateStr} | {timeStr}
            </p>
            <p className="font-bold">PAYMENT DUE BY: {dateStr}</p>
          </div>
          <p className="font-serif text-4xl text-red-600">AED {total.toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-bold">{customer.name.toUpperCase()}</p>
            {customer.address && <p>{customer.address}</p>}
            <p>{customer.phone}</p>
            {vehicleLine && <p>{vehicleLine}</p>}
            {jobDescription && <p className="font-bold">{jobDescription}</p>}
          </div>
          <div className="text-right">
            <p className="font-bold">{settings?.shop_name ?? "Al Bahir Garage"}</p>
            {settings?.address && <p>{settings.address}</p>}
            {settings?.phone && <p>{settings.phone}</p>}
            {settings?.facsimile && <p>{settings.facsimile}</p>}
          </div>
        </div>

        <hr className="border-t-4 border-black mb-4" />

        <table className="w-full mb-4 border-collapse">
          <thead>
            <tr className="text-left font-serif uppercase">
              <th className="pb-2 w-20">Quantity</th>
              <th className="pb-2">Details</th>
              <th className="pb-2 text-right w-28">Unit Price</th>
              <th className="pb-2 text-right w-28">Line Total</th>
              <th className="pb-2 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const warrantyUntil = item.warranty_days
                ? new Date(new Date(createdAt).getTime() + item.warranty_days * 86400000)
                : null;
              const warrantyActive = warrantyUntil && warrantyUntil.getTime() > Date.now();
              return (
                <tr key={item.id} className={i % 2 === 0 ? "bg-red-50" : ""}>
                  <td className="py-1.5">{item.quantity}</td>
                  <td className="py-1.5">
                    {item.description}
                    {warrantyUntil && (
                      <p className={`text-[10px] ${warrantyActive ? "text-emerald-600" : "text-slate-400"}`}>
                        🛡 {item.warranty_days}-day warranty{" "}
                        {warrantyActive ? "until" : "expired"} {warrantyUntil.toLocaleDateString()}
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 text-right">{item.unit_price.toFixed(2)}</td>
                  <td className="py-1.5 text-right">{(item.quantity * item.unit_price).toFixed(2)}</td>
                  <td className="py-1.5 text-right print:hidden">
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {Array.from({ length: paddingRows }).map((_, i) => (
              <tr key={`pad-${i}`} className={(items.length + i) % 2 === 0 ? "bg-red-50" : ""}>
                <td className="py-1.5">&nbsp;</td>
                <td className="py-1.5" />
                <td className="py-1.5" />
                <td className="py-1.5" />
                <td className="py-1.5 print:hidden" />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-4">
          <div className="w-64 space-y-1">
            <div className="flex justify-between">
              <span>Sub Total</span>
              <span className="font-bold">AED {subtotal.toFixed(2)}</span>
            </div>
            {showVat && (
              <div className="flex justify-between">
                <span>VAT ({vatRate}%)</span>
                <span className="font-bold">AED {vatAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Advance/Discount</span>
              <span className="font-bold">{discount > 0 ? `-AED ${discount.toFixed(2)}` : "-"}</span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1">
              <span>Remaining Balance</span>
              <span className="font-bold">AED {remainingBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <div className="w-64 flex justify-between font-serif text-2xl text-red-600">
            <span>TOTAL</span>
            <span>AED {total.toFixed(2)}</span>
          </div>
        </div>

        <hr className="border-t-4 border-black mb-4" />

        <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
          <div>
            <p className="font-serif text-red-600 font-semibold mb-1">PAYMENT DETAILS</p>
            <p>Payment Reference: {reference}</p>
            <p>Payment Method: {settings?.payment_method_note ?? "Cash Only"}</p>
            {settings?.payment_instructions && (
              <p className="font-bold mt-1">{settings.payment_instructions}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-serif text-red-600 font-semibold mb-1">CONTACT INFORMATION</p>
            {settings?.facsimile && <p>Facsimile: {settings.facsimile}</p>}
            {settings?.website && <p>{settings.website}</p>}
            {settings?.email && <p>{settings.email}</p>}
          </div>
        </div>

        <hr className="border-t-4 border-black mb-2" />
        <p className="border-b border-slate-300 pb-2 mb-2">
          This is computer generated report/invoice hence no sign or stamp require
        </p>
        {settings?.invoice_disclaimer && (
          <p className="text-xs text-red-600 font-bold">{settings.invoice_disclaimer}</p>
        )}
        {settings?.portal_url && (
          <p className="mt-3 text-center text-xs text-slate-400">
            Check your vehicle&apos;s service status anytime at{" "}
            <span className="text-slate-600">{settings.portal_url}</span>
          </p>
        )}
      </div>
    </div>
  );
}
