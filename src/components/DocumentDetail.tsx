import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addInvoiceItem,
  deleteInvoiceItem,
  markInvoicePaid,
  convertEstimateToInvoice,
} from "@/app/invoices/actions";
import { PrintButton } from "@/components/PrintButton";
import { InvoiceItemForm } from "@/components/InvoiceItemForm";
import { Badge, Card, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { DocumentType, InvoiceItem, Part, ShopSettings } from "@/lib/types";

type DocDetail = {
  id: string;
  status: "unpaid" | "paid";
  document_type: DocumentType;
  vat_rate: number;
  created_at: string;
  paid_at: string | null;
  customers: { name: string; phone: string; address: string | null } | null;
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

  const { data: doc } = await supabase
    .from("invoices")
    .select("id, status, document_type, vat_rate, created_at, paid_at, customers(name, phone, address)")
    .eq("id", id)
    .single<DocDetail>();

  if (!doc || doc.document_type !== expectedType) {
    notFound();
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at")
    .returns<InvoiceItem[]>();

  const { data: parts } = await supabase
    .from("parts")
    .select("*")
    .order("name")
    .returns<Part[]>();

  const { data: settings } = await supabase
    .from("shop_settings")
    .select("*")
    .limit(1)
    .maybeSingle<ShopSettings>();

  const subtotal = (items ?? []).reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmount = subtotal * (doc.vat_rate / 100);
  const total = subtotal + vatAmount;

  const isEstimate = doc.document_type === "estimate";
  const addItemWithId = addInvoiceItem.bind(null, id);
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
            <Badge color={doc.status === "paid" ? "green" : "red"}>
              {doc.status === "paid" ? "Paid" : "Unpaid"}
            </Badge>
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
        {isEstimate ? (
          <form action={convertEstimateToInvoice.bind(null, id)}>
            <PrimaryButton type="submit">Convert to Invoice</PrimaryButton>
          </form>
        ) : (
          doc.status === "unpaid" && (
            <form action={markInvoicePaid.bind(null, id)}>
              <SecondaryButton type="submit">Mark as Paid</SecondaryButton>
            </form>
          )
        )}
      </div>

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
