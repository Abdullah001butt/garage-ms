import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { AutoPrint } from "@/components/AutoPrint";
import { Suspense } from "react";
import { Morph } from "@/components/Morph";
import { updateInvoiceItemInline } from "@/app/inline-actions";
import { formatDate, formatAed } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addInvoiceItem,
  deleteInvoiceItem,
  recordPayment,
  deletePayment,
  convertEstimateToInvoice,
  applyJobTemplate,
} from "@/app/invoices/actions";
import { updateDiscount } from "@/app/invoices/discount-actions";
import { PrintButton } from "@/components/PrintButton";
import { InvoiceItemForm } from "@/components/InvoiceItemForm";
import { InvoiceDesign } from "@/components/InvoiceDesign";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { SendInvoicePdfButton } from "@/components/SendInvoicePdfButton";
import { Alert, Badge, Panel, PrimaryButton, SecondaryButton, Field, labelClass, inputClass } from "@/components/ui";
import type { DocumentType, InvoiceItem, JobTemplate, Part, Payment, ShopSettings } from "@/lib/types";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { formatCreditNoteNumber } from "@/lib/invoice-math";
import { createCreditNote, deleteCreditNote } from "@/app/invoices/credit-actions";
import { SlideOver } from "@/components/SlideOver";
import { RowMenu, RowMenuDelete, RowMenuLink } from "@/components/RowMenu";

type CreditNoteRow = {
  id: string;
  credit_number: number;
  amount: number;
  vat_amount: number;
  reason: string;
  refund_amount: number;
  refund_method: string | null;
  restocked: boolean;
  created_by: string | null;
  created_at: string;
};

type DocDetail = {
  id: string;
  status: "unpaid" | "partial" | "paid" | "credited";
  document_type: DocumentType;
  vat_rate: number;
  discount: number;
  created_at: string;
  paid_at: string | null;
  job_card_id: string | null;
  invoice_number: number | null;
  customers: { name: string; phone: string; address: string | null } | null;
  job_cards: {
    description: string;
    driver_name?: string | null;
    vehicles: { plate_number: string; make: string | null; model: string | null; year: number | null; share_token?: string | null } | null;
  } | null;
};

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "gray"> = {
  paid: "green",
  partial: "amber",
  unpaid: "red",
  credited: "gray",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
  credited: "Credited",
};

export async function DocumentDetail({
  id,
  expectedType,
  backHref,
  justSold = false,
}: {
  id: string;
  expectedType: DocumentType;
  backHref: string;
  /** Arrived here straight after completing a counter sale. */
  justSold?: boolean;
}) {
  const supabase = await createClient();

  const [{ data: doc }, { data: items }, { data: parts }, { data: settings }, { data: payments }, { data: jobTemplates }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, status, document_type, vat_rate, discount, created_at, paid_at, job_card_id, invoice_number, customers(name, phone, address), job_cards(description, driver_name, vehicles(plate_number, make, model, year, share_token))"
        )
        .eq("id", id)
        .single<DocDetail>(),
      supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", id)
        .order("created_at")
        .returns<InvoiceItem[]>(),
      supabase.from("parts").select("*").order("name").returns<Part[]>(),
      supabase.from("shop_settings").select("*").limit(1).maybeSingle<ShopSettings>(),
      supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", id)
        .order("paid_at", { ascending: false })
        .returns<Payment[]>(),
      supabase.from("job_templates").select("*").order("created_at").returns<JobTemplate[]>(),
    ]);
  const { data: creditNotes } = await supabase.from("credit_notes").select("*").eq("invoice_id", id).order("created_at").returns<CreditNoteRow[]>();

  if (!doc || doc.document_type !== expectedType) {
    notFound();
  }

  const subtotal = (items ?? []).reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const total = subtotal - doc.discount;
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalCredited = (creditNotes ?? []).reduce((sum, c) => sum + Number(c.amount), 0);
  const balanceDue = Math.max(total - totalCredited - totalPaid, 0);
  // Same rule as the server: (items + VAT) − discount − earlier credit notes.
  const creditable = Math.max(subtotal * (1 + Number(doc.vat_rate) / 100) - doc.discount - totalCredited, 0);

  const isEstimate = doc.document_type === "estimate";
  const addItemWithId = addInvoiceItem.bind(null, id);
  const recordPaymentWithId = recordPayment.bind(null, id);
  const deleteItemWithId = deleteInvoiceItem.bind(null, id);
  const updateDiscountWithId = updateDiscount.bind(null, id);
  const applyTemplateWithId = applyJobTemplate.bind(null, id);

  const customerFirstName = doc.customers?.name?.split(" ")[0] ?? "there";
  const vehicleLabel = doc.job_cards?.vehicles?.plate_number ?? "your vehicle";
  const notifyMessage = isEstimate
    ? `Hi ${customerFirstName}, here's the estimate for ${vehicleLabel}: ${formatAed(total)}. Let us know if you'd like to go ahead. — Al Bahir Garage`
    : balanceDue > 0
    ? `Hi ${customerFirstName}, your invoice for ${vehicleLabel} is ${formatAed(total)}, with a remaining balance of ${formatAed(balanceDue)}. — Al Bahir Garage`
    : `Hi ${customerFirstName}, your invoice for ${vehicleLabel} (${formatAed(total)}) is fully paid. Thank you for choosing Al Bahir Garage!`;

  const docNumber = isEstimate ? "Estimate" : formatInvoiceNumber(doc.invoice_number, doc.created_at) ?? "Invoice";

  return (
    <div className="page print:full-width">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900 print:hidden"
      >
        ← Back to {isEstimate ? "estimates" : "invoices"}
      </Link>

      {doc.status === "credited" && (
        <Alert tone="info" icon="file" className="mb-5 print:hidden" title="This invoice has been cancelled by credit note">
          {(creditNotes ?? []).map((c) => formatCreditNoteNumber(c.credit_number, c.created_at)).join(", ")} · {formatAed(totalCredited)} credited. It no longer counts as money owed.
        </Alert>
      )}

      {justSold && (
        <Alert tone="success" icon="check-circle" className="mb-5 print:hidden" title="Sale complete — paid in full">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Stock and today&apos;s cash are updated. Print the receipt below or start the next sale.</span>
            <Link href="/counter-sale" className="font-medium text-emerald-900 underline underline-offset-2">
              New counter sale →
            </Link>
          </span>
        </Alert>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Morph name={`doc-${doc.id}`}>
              <h1 className="font-display text-[28px] font-bold uppercase leading-none tracking-[0.01em] text-zinc-900 sm:text-[32px]">{docNumber}</h1>
            </Morph>
            {!isEstimate && (
              <Badge color={STATUS_COLOR[doc.status]} dot>
                {STATUS_LABEL[doc.status]}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {doc.customers?.name}
            {doc.job_cards?.vehicles?.plate_number ? ` · ${doc.job_cards.vehicles.plate_number}` : ""} ·{" "}
            {formatDate(doc.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton label="Print" />
          {doc.customers?.phone && <WhatsAppButton phone={doc.customers.phone} message={notifyMessage} label="Notify" />}
          {!isEstimate && doc.status === "paid" && doc.customers?.phone && settings?.google_review_link && (
            <WhatsAppButton
              phone={doc.customers.phone}
              label="Request review"
              message={`Hi ${customerFirstName}, thank you for choosing Al Bahir Garage! If you were happy with our service, we'd really appreciate a quick Google review: ${settings.google_review_link}`}
            />
          )}
          {doc.customers?.phone && (
            <SendInvoicePdfButton
              invoiceId={id}
              phone={doc.customers.phone}
              customerFirstName={customerFirstName}
              documentLabel={isEstimate ? "Estimate" : "Invoice"}
            />
          )}
          {isEstimate && (
            <form action={convertEstimateToInvoice.bind(null, id)}>
              <PrimaryButton type="submit" icon="receipt">
                Convert to invoice
              </PrimaryButton>
            </form>
          )}
        </div>
      </div>

      <Suspense fallback={null}>
        <AutoPrint />
      </Suspense>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] print:block">
        <div className="min-w-0">
          <InvoiceDesign
            defaultStyle={settings?.invoice_style === "modern" ? "modern" : "classic"}
            qrPath={doc.job_cards?.vehicles?.share_token ? `/certificate/${doc.job_cards.vehicles.share_token}` : null}
            documentLabel={isEstimate ? "ESTIMATE" : "INVOICE"}
            createdAt={doc.created_at}
            items={items ?? []}
            discount={doc.discount}
            vatRate={doc.vat_rate}
            totalPaid={totalPaid}
            settings={settings}
            customer={{
              name: doc.customers?.name ?? "",
              phone: doc.customers?.phone ?? "",
              address: doc.customers?.address ?? null,
            }}
            vehicle={doc.job_cards?.vehicles ?? null}
            jobDescription={doc.job_cards?.description ?? null}
            driverName={doc.job_cards?.driver_name ?? null}
            onDeleteItem={deleteItemWithId}
            onEditItem={updateInvoiceItemInline.bind(null, id)}
            linesLocked={doc.status === "credited" || (creditNotes ?? []).length > 0}
            invoiceNumber={isEstimate ? null : formatInvoiceNumber(doc.invoice_number, doc.created_at)}
          />

          <Panel title="Add line item" className="mt-6 print:hidden">
            <div className="p-4">
              <InvoiceItemForm parts={parts ?? []} action={addItemWithId} />
            </div>
          </Panel>
        </div>

        <aside className="space-y-6 print:hidden">
          {!isEstimate && (
            <Panel
              title="Payments"
              action={
                <span className={`font-medium tabular ${balanceDue > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {balanceDue > 0 ? `${formatAed(balanceDue)} due` : "Settled"}
                </span>
              }
            >
              <ul className="divide-y divide-zinc-100">
                {payments?.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className={`font-medium tabular ${Number(p.amount) < 0 ? "text-red-700" : "text-zinc-900"}`}>
                        {Number(p.amount) < 0 ? `Refund ${formatAed(-Number(p.amount))}` : formatAed(Number(p.amount))}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        <span className="capitalize">{p.method.replace("_", " ")}</span> ·{" "}
                        {formatDate(p.paid_at)}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <ConfirmSubmitButton action={deletePayment.bind(null, id, p.id)} successMessage="Payment removed.">
                      Remove
                    </ConfirmSubmitButton>
                  </li>
                ))}
                {payments?.length === 0 && <li className="px-4 py-4 text-[13px] text-zinc-400">No payments recorded yet.</li>}
              </ul>

              {balanceDue > 0 && (
                <form action={recordPaymentWithId} className="grid grid-cols-2 gap-3 border-t border-zinc-200 p-4">
                  <Field label="Amount (AED)" name="amount" type="number" step="0.01" defaultValue={balanceDue.toFixed(2)} required />
                  <label className="block">
                    <span className={labelClass}>Method</span>
                    <select name="method" className={inputClass}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="ziina">Ziina</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <Field label="Notes" name="notes" className="col-span-2" />
                  <div className="col-span-2">
                    <PrimaryButton type="submit" className="w-full">
                      Record payment
                    </PrimaryButton>
                  </div>
                </form>
              )}
            </Panel>
          )}

          {!isEstimate && (
            <Panel
              title="Credit notes & refunds"
              count={creditNotes?.length ?? 0}
              action={
                creditable > 0.01 ? (
                  <SlideOver
                    id="issue-credit-note"
                    title="Issue credit note"
                    description="Reduces what the customer owes and the VAT on this invoice. Use it to cancel a bill or give money back."
                    triggerLabel="Issue"
                    triggerIcon="file"
                    variant="secondary"
                  >
                    <form action={createCreditNote.bind(null, id)} className="space-y-4">
                      <Field label="Credit amount incl. VAT (AED)" name="amount" type="number" step="0.01" defaultValue={creditable.toFixed(2)} required />
                      <p className="-mt-2 text-xs text-zinc-500">Up to {formatAed(creditable)} can be credited. The full amount cancels the invoice.</p>
                      <Field label="Reason" name="reason" placeholder="e.g. Wrong part billed, job cancelled" required />
                      <label className="block">
                        <span className={labelClass}>Give money back?</span>
                        <select name="refund_method" defaultValue={totalPaid > 0 ? "cash" : "none"} className={inputClass}>
                          <option value="none">No — just reduce what they owe</option>
                          <option value="cash">Yes — refund in cash</option>
                          <option value="card">Yes — refund to card</option>
                          <option value="bank_transfer">Yes — bank transfer</option>
                          <option value="ziina">Yes — Ziina</option>
                        </select>
                        <span className="mt-1.5 block text-xs text-zinc-500">
                          Refunds are limited to what was paid ({formatAed(Math.max(totalPaid, 0))}) and show as money out in Cash Flow.
                        </span>
                      </label>
                      <label className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[13px] text-zinc-700">
                        <input type="checkbox" name="restock" className="mt-0.5 h-4 w-4 accent-zinc-900" />
                        <span>
                          <span className="block font-medium text-zinc-900">Return this invoice&apos;s parts to stock</span>
                          Tick when the whole job is cancelled and the parts are back on the shelf.
                        </span>
                      </label>
                      <PrimaryButton type="submit" className="w-full">
                        Issue credit note
                      </PrimaryButton>
                    </form>
                  </SlideOver>
                ) : undefined
              }
            >
              {(creditNotes?.length ?? 0) === 0 ? (
                <p className="px-4 py-4 text-[13px] text-zinc-400">No credit notes. Use one to cancel or refund instead of deleting lines.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {creditNotes!.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 px-4 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <Link href={`/credit-notes/${c.id}`} className="font-display text-[15px] font-semibold tracking-[0.02em] text-zinc-900 hover:underline">
                          {formatCreditNoteNumber(c.credit_number, c.created_at)}
                        </Link>
                        <p className="text-xs text-zinc-500">
                          {formatDate(c.created_at)} · {c.reason}
                        </p>
                        {Number(c.refund_amount) > 0 && (
                          <p className="text-xs text-red-700">
                            Refunded {formatAed(Number(c.refund_amount))} · {String(c.refund_method).replace("_", " ")}
                          </p>
                        )}
                        {c.restocked && <p className="text-xs text-emerald-700">Parts returned to stock</p>}
                      </div>
                      <span className="shrink-0 font-medium tabular text-zinc-900">− {formatAed(Number(c.amount))}</span>
                      <RowMenu>
                        <RowMenuLink href={`/credit-notes/${c.id}`} icon="printer">
                          Print credit note
                        </RowMenuLink>
                        <RowMenuDelete
                          action={deleteCreditNote.bind(null, id, c.id)}
                          confirmMessage="Delete this credit note and its refund? Returned stock is not taken back."
                          successMessage="Credit note deleted."
                          label="Delete"
                        />
                      </RowMenu>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <Panel title="Advance / discount">
            <form action={updateDiscountWithId} className="flex items-end gap-2 p-4">
              <Field label="Amount (AED)" name="discount" type="number" step="0.01" defaultValue={doc.discount} className="flex-1" />
              <SecondaryButton type="submit">Update</SecondaryButton>
            </form>
          </Panel>

          {jobTemplates && jobTemplates.length > 0 && (
            <Panel title="Apply a job template">
              <form action={applyTemplateWithId} className="flex items-end gap-2 p-4">
                <label className="block flex-1">
                  <span className={labelClass}>Template</span>
                  <select name="template_id" required className={inputClass}>
                    <option value="">Select…</option>
                    {jobTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <SecondaryButton type="submit">Add items</SecondaryButton>
              </form>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
