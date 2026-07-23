import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addInvoiceItem,
  deleteInvoiceItem,
  recordPayment,
  deletePayment,
  convertEstimateToInvoice,
} from "@/app/invoices/actions";
import { PrintButton } from "@/components/PrintButton";
import { InvoiceItemForm } from "@/components/InvoiceItemForm";
import { Badge, Card, PrimaryButton, Field, labelClass, inputClass } from "@/components/ui";
import type { DocumentType, InvoiceItem, Part, Payment, ShopSettings } from "@/lib/types";

type DocDetail = {
  id: string;
  status: "unpaid" | "partial" | "paid";
  document_type: DocumentType;
  vat_rate: number;
  created_at: string;
  paid_at: string | null;
  customers: { name: string; phone: string; address: string | null } | null;
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

  const [{ data: doc }, { data: items }, { data: parts }, { data: settings }, { data: payments }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, status, document_type, vat_rate, created_at, paid_at, customers(name, phone, address)")
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
    ]);

  if (!doc || doc.document_type !== expectedType) {
    notFound();
  }

  const subtotal = (items ?? []).reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmount = subtotal * (doc.vat_rate / 100);
  const total = subtotal + vatAmount;
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Math.max(total - totalPaid, 0);

  const isEstimate = doc.document_type === "estimate";
  const addItemWithId = addInvoiceItem.bind(null, id);
  const recordPaymentWithId = recordPayment.bind(null, id);
  const label = isEstimate ? "Estimate" : "Invoice";

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <Link href={backHref} className="text-sm text-indigo-600 hover:underline print:hidden">
        &larr; Back to {isEstimate ? "estimates" : "invoices"}
      </Link>

      <Card className="mt-4 mb-6 p-6 print:shadow-none print:border-none">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-lg font-bold text-slate-900">{settings?.shop_name ?? "Al Bahir Garage"}</p>
            {settings?.trn && <p className="text-xs text-slate-500">TRN: {settings.trn}</p>}
            {settings?.address && <p className="text-xs text-slate-500">{settings.address}</p>}
            {settings?.phone && <p className="text-xs text-slate-500">{settings.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-slate-900">{label}</p>
            <p className="text-xs text-slate-400">
              {new Date(doc.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-start justify-between mb-6 pb-6 border-b border-slate-100">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Bill to</p>
            <p className="font-medium text-slate-900">{doc.customers?.name}</p>
            <p className="text-sm text-slate-500">{doc.customers?.phone}</p>
            {doc.customers?.address && (
              <p className="text-sm text-slate-500">{doc.customers.address}</p>
            )}
          </div>
          {!isEstimate && (
            <Badge color={STATUS_COLOR[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
          )}
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium text-right">Qty</th>
              <th className="py-2 font-medium text-right">Unit Price</th>
              <th className="py-2 font-medium text-right">Total</th>
              <th className="print:hidden" />
            </tr>
          </thead>
          <tbody>
            {items?.map((item) => (
              <tr key={item.id} className="border-b border-slate-50">
                <td className="py-2">{item.description}</td>
                <td className="py-2 capitalize text-slate-500">{item.item_type}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{item.unit_price.toFixed(2)}</td>
                <td className="py-2 text-right font-medium">
                  {(item.quantity * item.unit_price).toFixed(2)}
                </td>
                <td className="py-2 text-right print:hidden">
                  <form action={deleteInvoiceItem.bind(null, id, item.id)}>
                    <button type="submit" className="text-red-500 hover:underline text-xs">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {items?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  No items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>AED {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>VAT ({doc.vat_rate}%)</span>
              <span>AED {vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-900 pt-1 border-t border-slate-200">
              <span>Total</span>
              <span>AED {total.toFixed(2)}</span>
            </div>
            {!isEstimate && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>Paid</span>
                  <span>AED {totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-red-600">
                  <span>Balance Due</span>
                  <span>AED {balanceDue.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {settings?.portal_url && (
          <p className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
            Check your vehicle&apos;s service status anytime at{" "}
            <span className="text-slate-600">{settings.portal_url}</span>
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2 mb-8 print:hidden">
        <PrintButton />
        {isEstimate && (
          <form action={convertEstimateToInvoice.bind(null, id)}>
            <PrimaryButton type="submit">Convert to Invoice</PrimaryButton>
          </form>
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
