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
import { Badge, Card, PrimaryButton, SecondaryButton, Field, labelClass, inputClass } from "@/components/ui";
import type { DocumentType, InvoiceItem, JobTemplate, Part, Payment, ShopSettings } from "@/lib/types";

type DocDetail = {
  id: string;
  status: "unpaid" | "partial" | "paid";
  document_type: DocumentType;
  vat_rate: number;
  discount: number;
  created_at: string;
  paid_at: string | null;
  job_card_id: string | null;
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
          "id, status, document_type, vat_rate, discount, created_at, paid_at, job_card_id, customers(name, phone, address), job_cards(description, vehicles(plate_number, make, model, year))"
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

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8 print:full-width">
      <Link href={backHref} className="text-sm text-indigo-600 hover:underline print:hidden">
        &larr; Back to {isEstimate ? "estimates" : "invoices"}
      </Link>

      <div className="mt-4 mb-2 flex items-center justify-between print:hidden">
        {!isEstimate && <Badge color={STATUS_COLOR[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>}
      </div>

      <div className="mt-4 mb-6">
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
        />
      </div>

      <Card className="p-4 mb-6 print:hidden">
        <form action={updateDiscountWithId} className="flex flex-wrap items-end gap-4">
          <Field label="Advance/Discount (AED)" name="discount" type="number" step="0.01" defaultValue={doc.discount} />
          <SecondaryButton type="submit">Update</SecondaryButton>
        </form>
      </Card>

      <div className="flex flex-wrap gap-2 mb-8 print:hidden">
        <PrintButton />
        {isEstimate && (
          <form action={convertEstimateToInvoice.bind(null, id)}>
            <PrimaryButton type="submit">Convert to Invoice</PrimaryButton>
          </form>
        )}
        {doc.customers?.phone && <WhatsAppButton phone={doc.customers.phone} message={notifyMessage} />}
        {!isEstimate && doc.status === "paid" && doc.customers?.phone && settings?.google_review_link && (
          <WhatsAppButton
            phone={doc.customers.phone}
            label="Request Review"
            message={`Hi ${customerFirstName}, thank you for choosing Al Bahir Garage! If you were happy with our service, we'd really appreciate a quick Google review: ${settings.google_review_link}`}
          />
        )}
      </div>

      {!isEstimate && (
        <Card className="p-5 mb-6 print:hidden">
          <p className="text-sm font-semibold text-slate-700 mb-3">Payments</p>
          <ul className="divide-y divide-slate-100 mb-4">
            {payments?.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-900">AED {Number(p.amount).toFixed(2)}</span>
                  <span className="text-slate-500 capitalize"> · {p.method.replace("_", " ")}</span>
                  <span className="text-slate-400"> · {new Date(p.paid_at).toLocaleDateString()}</span>
                  {p.notes && <span className="text-slate-400"> · {p.notes}</span>}
                </div>
                <form action={deletePayment.bind(null, id, p.id)}>
                  <button type="submit" className="text-xs text-red-500 hover:underline">
                    Remove
                  </button>
                </form>
              </li>
            ))}
            {payments?.length === 0 && (
              <li className="py-3 text-sm text-slate-400">No payments recorded yet.</li>
            )}
          </ul>

          {balanceDue > 0 && (
            <form action={recordPaymentWithId} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Amount (AED)"
                name="amount"
                type="number"
                step="0.01"
                defaultValue={balanceDue.toFixed(2)}
                required
              />
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
                <PrimaryButton type="submit">Record Payment</PrimaryButton>
              </div>
            </form>
          )}
        </Card>
      )}

      {jobTemplates && jobTemplates.length > 0 && (
        <Card className="p-4 mb-6 print:hidden">
          <p className="text-sm font-semibold text-slate-700 mb-2">Apply a Job Template</p>
          <form action={applyTemplateWithId} className="flex flex-wrap items-end gap-3">
            <select name="template_id" required className={inputClass + " max-w-xs"}>
              <option value="">Select a template...</option>
              {jobTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <SecondaryButton type="submit">Add Its Items</SecondaryButton>
          </form>
        </Card>
      )}

      <Card className="p-4 print:hidden">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            + Add line item
          </summary>
          <InvoiceItemForm parts={parts ?? []} action={addItemWithId} />
        </details>
      </Card>
    </div>
  );
}
