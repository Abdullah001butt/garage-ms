"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatDate } from "@/lib/format";
import { aedInWords } from "@/lib/amount-words";
import type { InvoiceItem, ShopSettings } from "@/lib/types";
import { FitToWidth } from "@/components/FitToWidth";
import { InlineEdit } from "@/components/InlineEdit";
import type { InlineResult } from "@/app/inline-actions";

type Customer = { name: string; phone: string; address: string | null; trn?: string | null };
type VehicleInfo = { plate_number: string; make: string | null; model: string | null; year: number | null } | null;

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TYPE_LABEL: Record<string, string> = { part: "Part", labor: "Labour", service: "Service" };

// Hex colours only: html2canvas (Send PDF) cannot read the oklch colours of the default palette.
const INK = "text-[#111214]";
const MUTED = "text-[#5C5F66]";
const CAPS = "text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8C93]";

/**
 * Showroom invoice/estimate: graphite title band, red rule, condensed figures,
 * amount in words, VAT summary, signatures and the service-history QR.
 * Same data, print and PDF id as the Classic and Modern designs.
 */
export function ShowroomInvoiceTemplate({
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
  onEditItem,
  linesLocked = false,
  invoiceNumber,
  showVat,
  qrPath,
  driverName,
  odometer,
  mechanicName,
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
  onEditItem?: (itemId: string, field: "description" | "quantity" | "unit_price", raw: string) => Promise<InlineResult>;
  linesLocked?: boolean;
  invoiceNumber?: string | null;
  showVat: boolean;
  qrPath?: string | null;
  driverName?: string | null;
  odometer?: number | null;
  mechanicName?: string | null;
}) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!qrPath) return;
    QRCode.toDataURL(`${window.location.origin}${qrPath}`, { margin: 0, width: 220, color: { dark: "#111214", light: "#ffffff" } })
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
  const validUntil = new Date(issued.getTime() + 14 * 86400000);
  const paid = !isEstimate && items.length > 0 && balance < 0.01;
  const status = isEstimate
    ? null
    : paid
      ? { label: "Paid", cls: "bg-[#1B7F4B] text-white" }
      : totalPaid > 0
        ? { label: "Part paid", cls: "bg-[#F2B544] text-[#111214]" }
        : { label: "Payment due", cls: "bg-[#D41F31] text-white" };
  const nowMs = new Date().getTime();
  const shopName = settings?.shop_name ?? "AL BAHIR VEHICLES REPAIR LLC";
  const vehicleName = vehicle ? [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") : "";

  return (
    <FitToWidth width={760}>
      <div
        id="invoice-printable"
        className={`overflow-hidden rounded-xl border border-[#E4E4E7] bg-white font-sans text-[12.5px] leading-snug ${INK} shadow-sm print:rounded-none print:border-none print:shadow-none`}
      >
        {/* Letterhead */}
        <div className="flex items-start justify-between gap-6 px-9 pb-5 pt-7 print:pt-0 print:pb-4">
          <img src="/logoalbahir.png" alt="Al Bahir Garage" className="h-[60px] w-auto object-contain" />
          <div className={`text-right text-[11.5px] ${MUTED}`}>
            <p className={`font-display text-[17px] font-bold uppercase tracking-[0.08em] ${INK}`}>{shopName}</p>
            {settings?.address && <p className="ml-auto max-w-[19rem]">{settings.address}</p>}
            <p>{[settings?.phone, settings?.email].filter(Boolean).join("  ·  ")}</p>
            {settings?.website && <p>{settings.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</p>}
            {settings?.trn && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded border border-[#D4D4D8] px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.06em] text-[#111214]">
                TRN <span className="tabular-nums">{settings.trn}</span>
              </p>
            )}
          </div>
        </div>

        {/* Title band */}
        <div className="flex items-stretch justify-between gap-6 bg-[#141519] px-9 py-5 text-white">
          <div className="flex flex-col justify-center">
            <p className="font-display text-[34px] font-bold uppercase leading-none tracking-[0.06em]">{title}</p>
            <div className="mt-2.5 flex items-center gap-2.5">
              {status && <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${status.cls}`}>{status.label}</span>}
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A9ABB2]">{isEstimate ? "Quotation for approval" : "Original for recipient"}</span>
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-[#2E3037] self-center text-right">
            <div className="pr-5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A9ABB2]">{isEstimate ? "Estimate" : "Invoice no."}</dt>
              <dd className="mt-1 whitespace-nowrap font-display text-[19px] font-semibold tracking-[0.02em]">{invoiceNumber ?? "Draft"}</dd>
            </div>
            <div className="px-5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A9ABB2]">Date</dt>
              <dd className="mt-1 whitespace-nowrap font-display text-[19px] font-semibold">{formatDate(createdAt)}</dd>
            </div>
            <div className="pl-5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A9ABB2]">{isEstimate ? "Valid until" : "Due"}</dt>
              <dd className="mt-1 whitespace-nowrap font-display text-[19px] font-semibold">{isEstimate ? formatDate(validUntil) : "On receipt"}</dd>
            </div>
          </dl>
        </div>
        <div className="h-1 bg-[#D41F31]" />

        {/* Parties */}
        <div className="grid grid-cols-3 divide-x divide-[#E4E4E7] border-b border-[#E4E4E7]">
          <div className="px-9 py-5">
            <p className={CAPS}>{isEstimate ? "Prepared for" : "Bill to"}</p>
            <p className="mt-2 font-display text-[16px] font-bold uppercase tracking-[0.02em]">{customer.name}</p>
            {customer.phone && <p className={MUTED}>{customer.phone}</p>}
            {customer.address && <p className={MUTED}>{customer.address}</p>}
            {customer.trn && <p className="mt-1 text-[11px] font-semibold">TRN <span className="tabular-nums">{customer.trn}</span></p>}
          </div>
          <div className="px-6 py-5">
            <p className={CAPS}>Vehicle</p>
            {vehicle ? (
              <>
                <span className="mt-2 inline-flex items-center rounded-[3px] border-2 border-[#111214] px-2 font-display text-[16px] font-bold leading-[1.4] tracking-[0.04em]">{vehicle.plate_number}</span>
                {vehicleName && <p className="mt-1.5 font-semibold">{vehicleName}</p>}
                {odometer ? <p className={MUTED}>Odometer {odometer.toLocaleString("en-US")} km</p> : null}
                {driverName && <p className={MUTED}>Driver: {driverName}</p>}
              </>
            ) : (
              <p className={`mt-2 ${MUTED}`}>Counter sale</p>
            )}
          </div>
          <div className="px-6 py-5 pr-9">
            <p className={CAPS}>Work carried out</p>
            <p className="mt-2 line-clamp-4 text-[#2A2C31]">{jobDescription || "Parts sale"}</p>
            {mechanicName && <p className={`mt-1 ${MUTED}`}>Technician: {mechanicName}</p>}
          </div>
        </div>

        {/* Lines */}
        <div className="px-9 pt-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#141519] text-left font-display text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white">
                <th className="w-9 py-2 pl-3">#</th>
                <th className="py-2 pr-3">Description</th>
                <th className="w-20 py-2">Type</th>
                <th className="w-14 py-2 text-right">Qty</th>
                <th className="w-28 py-2 text-right">Unit price</th>
                <th className="w-28 py-2 pr-3 text-right">Amount</th>
                <th className="w-12 bg-white print:hidden" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const until = item.warranty_days ? new Date(issued.getTime() + item.warranty_days * 86400000) : null;
                return (
                  <tr key={item.id} className={`border-b border-[#EDEDEF] align-top ${i % 2 ? "bg-[#F7F7F8]" : ""}`}>
                    <td className={`py-2.5 pl-3 tabular-nums ${MUTED}`}>{String(i + 1).padStart(2, "0")}</td>
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold">
                        {onEditItem ? <InlineEdit label="Description" value={item.description} disabled={linesLocked} action={(raw) => onEditItem(item.id, "description", raw)} /> : item.description}
                      </span>
                      {until && (
                        <p className={`mt-0.5 text-[11px] ${until.getTime() > nowMs ? "text-[#1B7F4B]" : "text-[#8A8C93]"}`}>
                          {item.warranty_days}-day warranty until {formatDate(until)}
                        </p>
                      )}
                    </td>
                    <td className={`py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] ${MUTED}`}>{TYPE_LABEL[item.item_type] ?? item.item_type}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {onEditItem ? <InlineEdit label="Quantity" kind="number" align="right" value={String(item.quantity)} disabled={linesLocked} action={(raw) => onEditItem(item.id, "quantity", raw)} /> : item.quantity}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {onEditItem ? (
                        <InlineEdit label="Unit price" kind="number" align="right" prefix="AED" value={item.unit_price.toFixed(2)} display={money(item.unit_price)} disabled={linesLocked} action={(raw) => onEditItem(item.id, "unit_price", raw)} />
                      ) : (
                        money(item.unit_price)
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{money(item.quantity * item.unit_price)}</td>
                    <td className="bg-white py-2.5 text-right print:hidden">
                      <ConfirmSubmitButton action={async () => void (await onDeleteItem(item.id))} successMessage="Line removed." className="text-[11px] font-medium text-[#8A8C93] hover:text-[#D41F31]">
                        Remove
                      </ConfirmSubmitButton>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#8A8C93]">
                    No line items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className={`mt-1.5 text-right text-[10.5px] ${MUTED}`}>
            {items.length} line{items.length === 1 ? "" : "s"} · amounts in UAE Dirhams (AED)
          </p>
        </div>

        {/* Words, VAT summary, payment | totals */}
        <div className="grid grid-cols-[1fr_17.5rem] gap-7 px-9 pt-5">
          <div className="space-y-4">
            <div className="rounded-md bg-[#F4F4F5] px-4 py-3">
              <p className={CAPS}>Amount in words</p>
              <p className="mt-1 font-semibold">{aedInWords(total)}</p>
            </div>
            {showVat && (
              <div>
                <p className={CAPS}>VAT summary</p>
                <table className="mt-1.5 w-full border-collapse text-[11.5px]">
                  <thead>
                    <tr className="border-b border-[#111214] text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5C5F66]">
                      <th className="py-1">Taxable amount</th>
                      <th className="py-1 text-center">Rate</th>
                      <th className="py-1 text-right">VAT</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="tabular-nums">
                      <td className="py-1.5">AED {money(subtotal)}</td>
                      <td className="py-1.5 text-center">{vatRate}%</td>
                      <td className="py-1.5 text-right">AED {money(vatAmount)}</td>
                      <td className="py-1.5 text-right font-semibold">AED {money(subtotal + vatAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {isEstimate ? (
              <div>
                <p className={CAPS}>Terms</p>
                <p className="mt-1 text-[#2A2C31]">Prices are valid until {formatDate(validUntil)}. Work starts once this estimate is approved; parts found worn during the job are quoted before fitting.</p>
              </div>
            ) : (
              <div>
                <p className={CAPS}>Payment details</p>
                <p className="mt-1 text-[#2A2C31]">
                  {settings?.payment_method_note ?? "Cash only"} · Reference <span className="font-semibold">{invoiceNumber ?? "—"}</span>
                </p>
                {settings?.payment_instructions && <p className="font-semibold">{settings.payment_instructions}</p>}
              </div>
            )}
          </div>

          <div>
            <dl className="tabular-nums">
              <div className="flex justify-between border-b border-[#EDEDEF] py-1.5">
                <dt className={MUTED}>Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              {showVat && (
                <div className="flex justify-between border-b border-[#EDEDEF] py-1.5">
                  <dt className={MUTED}>VAT {vatRate}%</dt>
                  <dd>{money(vatAmount)}</dd>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between border-b border-[#EDEDEF] py-1.5">
                  <dt className={MUTED}>Advance / discount</dt>
                  <dd>− {money(discount)}</dd>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between bg-[#141519] px-3.5 py-3 text-white">
                <dt className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-[#C9CACF]">Total</dt>
                <dd className="font-display text-[26px] font-bold leading-none">
                  <span className="mr-1 text-[13px] font-semibold text-[#A9ABB2]">AED</span>
                  {money(total)}
                </dd>
              </div>
              <div className="h-[3px] bg-[#D41F31]" />
              {!isEstimate && (
                <>
                  <div className="flex justify-between px-3.5 pt-2.5">
                    <dt className={MUTED}>Paid</dt>
                    <dd className="text-[#1B7F4B]">{money(totalPaid)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between px-3.5 pt-1">
                    <dt className="font-display text-[13px] font-bold uppercase tracking-[0.1em]">Balance due</dt>
                    <dd className={`font-display text-[18px] font-bold ${balance > 0.01 ? "text-[#D41F31]" : "text-[#1B7F4B]"}`}>AED {money(balance)}</dd>
                  </div>
                </>
              )}
            </dl>
            {paid && (
              <div aria-hidden="true" className="mt-4 flex justify-center">
                <span className="-rotate-6 rounded-md border-[3px] border-[#1B7F4B] px-4 py-0.5 font-display text-[26px] font-bold uppercase tracking-[0.2em] text-[#1B7F4B] opacity-85">
                  Paid in full
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Terms, signatures, QR */}
        <div className="px-9 pb-7 pt-6 print:pb-4 print:pt-4">
          {settings?.invoice_disclaimer && <p className={`mb-5 text-[10.5px] leading-relaxed ${MUTED}`}>{settings.invoice_disclaimer}</p>}
          <div className={`grid gap-8 ${qrPath ? "grid-cols-[1fr_1fr_auto]" : "grid-cols-2"}`}>
            <div className="flex flex-col justify-end">
              <div className="h-12 border-b border-[#111214] print:h-9" />
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">{isEstimate ? "Customer approval" : "Received by"}</p>
              <p className={`text-[10.5px] ${MUTED}`}>Name, signature &amp; date</p>
            </div>
            <div className="flex flex-col justify-end">
              <div className="h-12 border-b border-[#111214] print:h-9" />
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">For {shopName}</p>
              <p className={`text-[10.5px] ${MUTED}`}>Authorised signatory</p>
            </div>
            {qrPath && (
              <div className="flex w-28 flex-col items-center text-center">
                {qr ? <img src={qr} alt="QR code to this vehicle's service history" className="h-[84px] w-[84px]" /> : <div className="h-[84px] w-[84px] rounded bg-[#F4F4F5]" />}
                <p className={`mt-1.5 text-[9.5px] leading-tight ${MUTED}`}>Scan for this vehicle&apos;s service history</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer band */}
        <div className="h-[2px] bg-[#D41F31]" />
        <div className="flex items-center justify-between gap-4 bg-[#141519] px-9 py-3 text-[10.5px] text-[#A9ABB2]">
          <span className="font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-white">Thank you for choosing {settings?.shop_name ? settings.shop_name.replace(/ LLC$/i, "") : "Al Bahir Garage"}</span>
          <span>{[settings?.website?.replace(/^https?:\/\//, "").replace(/\/$/, ""), settings?.phone].filter(Boolean).join("  ·  ")}</span>
        </div>
      </div>
    </FitToWidth>
  );
}
