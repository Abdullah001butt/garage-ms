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
import { ClassicInvoiceTemplate } from "@/components/ClassicInvoiceTemplate";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { SendInvoicePdfButton } from "@/components/SendInvoicePdfButton";
import { Badge, Panel, PrimaryButton, SecondaryButton, Field, labelClass, inputClass } from "@/components/ui";
import type { DocumentType, InvoiceItem, JobTemplate, Part, Payment, ShopSettings } from "@/lib/types";
import { formatInvoiceNumber } from "@/lib/invoice-number";

type DocDetail = {
  id: string;
  status: "unpaid" | "partial" | "paid";
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
    vehicles: { plate_number: string; make: string | null; model: string | null; year: number | null } | null;
  } | null;
};

const STATUS_COLOR: Record<string, "green" | "amber" | "red"> = {
  paid: "green",
  partial: "amber",
  unpaid: "red",
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

export async function DocumentDetail({
  id,
  expectedType,
  backHref,
}: {
  id: string;
  expectedType: DocumentType;
  backHref: string;
}) {
  const supabase = await createClient();

  const [{ data: doc }, { data: items }, { data: parts }, { data: settings }, { data: payments }, { data: jobTemplates }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, status, document_type, vat_rate, discount, created_at, paid_at, job_card_id, invoice_number, customers(name, phone, address), job_cards(description, vehicles(plate_number, make, model, year))"
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

  if (!doc || doc.document_type !== expectedType) {
    notFound();
  }

  const subtotal = (items ?? []).reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const total = subtotal - doc.discount;
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Math.max(total - totalPaid, 0);

  const isEstimate = doc.document_type === "estimate";
  const addItemWithId = addInvoiceItem.bind(null, id);
  const recordPaymentWithId = recordPayment.bind(null, id);
  const deleteItemWithId = deleteInvoiceItem.bind(null, id);
  const updateDiscountWithId = updateDiscount.bind(null, id);
  const applyTemplateWithId = applyJobTemplate.bind(null, id);

  const customerFirstName = doc.customers?.name?.split(" ")[0] ?? "there";
  const vehicleLabel = doc.job_cards?.vehicles?.plate_number ?? "your vehicle";
  const notifyMessage = isEstimate
    ? `Hi ${customerFirstName}, here's the estimate for ${vehicleLabel}: AED ${total.toFixed(2)}. Let us know if you'd like to go ahead. — Al Bahir Garage`
    : balanceDue > 0
    ? `Hi ${customerFirstName}, your invoice for ${vehicleLabel} is AED ${total.toFixed(2)}, with a remaining balance of AED ${balanceDue.toFixed(2)}. — Al Bahir Garage`
    : `Hi ${customerFirstName}, your invoice for ${vehicleLabel} (AED ${total.toFixed(2)}) is fully paid. Thank you for choosing Al Bahir Garage!`;

  const docNumber = isEstimate ? "Estimate" : formatInvoiceNumber(doc.invoice_number, doc.created_at) ?? "Invoice";

  return (
    <div className="page print:full-width">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900 print:hidden"
      >
        ← Back to {isEstimate ? "estimates" : "invoices"}
      </Link>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-zinc-900">{docNumber}</h1>
            {!isEstimate && (
              <Badge color={STATUS_COLOR[doc.status]} dot>
                {STATUS_LABEL[doc.status]}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {doc.customers?.name}
            {doc.job_cards?.vehicles?.plate_number ? ` · ${doc.job_cards.vehicles.plate_number}` : ""} ·{" "}
            {new Date(doc.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] print:block">
        <div className="min-w-0">
          <ClassicInvoiceTemplate
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
            onDeleteItem={deleteItemWithId}
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
                  {balanceDue > 0 ? `AED ${balanceDue.toFixed(2)} due` : "Settled"}
                </span>
              }
            >
              <ul className="divide-y divide-zinc-100">
                {payments?.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 tabular">AED {Number(p.amount).toFixed(2)}</p>
                      <p className="truncate text-xs text-zinc-500">
                        <span className="capitalize">{p.method.replace("_", " ")}</span> ·{" "}
                        {new Date(p.paid_at).toLocaleDateString("en-GB")}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <form action={deletePayment.bind(null, id, p.id)}>
                      <button type="submit" className="text-xs font-medium text-zinc-500 hover:text-red-600">
                        Remove
                      </button>
                    </form>
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
