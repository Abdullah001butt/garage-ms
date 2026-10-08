import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ShopSettings } from "@/lib/types";
import { Card, PageHeader, SecondaryButton } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { formatAed, formatDate } from "@/lib/format";
import { formatCreditNoteNumber } from "@/lib/invoice-math";
import { formatInvoiceNumber } from "@/lib/invoice-number";

type CreditNoteDoc = {
  id: string;
  credit_number: number;
  amount: number;
  vat_amount: number;
  reason: string;
  refund_amount: number;
  refund_method: string | null;
  created_by: string | null;
  created_at: string;
  invoice_id: string;
  invoices: { invoice_number: number | null; created_at: string; vat_rate: number } | null;
  customers: { name: string; phone: string; address: string | null; trn_number: string | null } | null;
};

/** Printable tax credit note. */
export default async function CreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: note }, { data: settings }] = await Promise.all([
    supabase
      .from("credit_notes")
      .select("*, invoices(invoice_number, created_at, vat_rate), customers(name, phone, address, trn_number)")
      .eq("id", id)
      .maybeSingle<CreditNoteDoc>(),
    supabase.from("shop_settings").select("*").limit(1).maybeSingle<ShopSettings>(),
  ]);
  if (!note) notFound();

  const number = formatCreditNoteNumber(note.credit_number, note.created_at);
  const invoiceNo = note.invoices ? formatInvoiceNumber(note.invoices.invoice_number, note.invoices.created_at) : null;
  const net = Number(note.amount) - Number(note.vat_amount);

  return (
    <div className="page page-narrow">
      <Link href={`/invoices/${note.invoice_id}`} className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900 print:hidden">
        ← Back to invoice
      </Link>
      <PageHeader
        title={number}
        description={`Credit note against ${invoiceNo ?? "invoice"}`}
        action={
          <>
            <Link href={`/invoices/${note.invoice_id}`}>
              <SecondaryButton type="button">Open invoice</SecondaryButton>
            </Link>
            <PrintButton label="Print credit note" />
          </>
        }
      />

      <Card className="overflow-hidden print:border-0 print:shadow-none">
        <div className="h-1.5 bg-zinc-900" />
        <div className="p-8 text-[13px] text-zinc-800">
          <div className="flex items-start justify-between gap-6">
            <div>
              <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={140} height={40} className="h-12 w-auto object-contain" />
              <p className="mt-3 font-semibold text-zinc-900">{settings?.shop_name ?? "AL BAHIR VEHICLES REPAIR LLC"}</p>
              {settings?.address && <p className="text-zinc-500">{settings.address}</p>}
              {settings?.trn && <p className="text-zinc-500">TRN {settings.trn}</p>}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Tax credit note</p>
              <p className="mt-1 font-display text-[28px] font-bold leading-none tracking-[0.01em] text-zinc-900">{number}</p>
              <p className="mt-2 text-zinc-500">Date {formatDate(note.created_at)}</p>
              {invoiceNo && <p className="text-zinc-500">Against invoice <span className="font-semibold text-zinc-900">{invoiceNo}</span></p>}
            </div>
          </div>

          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
            <div className="bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Customer</p>
              <p className="mt-1.5 font-semibold text-zinc-900">{note.customers?.name}</p>
              <p className="text-zinc-500">{note.customers?.phone}</p>
              {note.customers?.trn_number && <p className="text-zinc-500">TRN {note.customers.trn_number}</p>}
            </div>
            <div className="bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Reason</p>
              <p className="mt-1.5 text-zinc-800">{note.reason}</p>
            </div>
          </div>

          <dl className="ml-auto mt-8 w-full max-w-xs">
            <div className="flex justify-between py-1">
              <dt className="text-zinc-500">Amount excl. VAT</dt>
              <dd className="tabular">{formatAed(net)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-zinc-500">VAT {note.invoices?.vat_rate ?? 5}%</dt>
              <dd className="tabular">{formatAed(Number(note.vat_amount))}</dd>
            </div>
            <div className="mt-1.5 flex items-center justify-between rounded-md bg-zinc-900 px-3 py-2.5 text-white">
              <dt className="font-semibold">Total credited</dt>
              <dd className="text-base font-semibold tabular">{formatAed(Number(note.amount))}</dd>
            </div>
            {Number(note.refund_amount) > 0 && (
              <div className="flex justify-between px-3 pt-2.5">
                <dt className="text-zinc-500">Refunded ({String(note.refund_method).replace("_", " ")})</dt>
                <dd className="tabular text-red-700">{formatAed(Number(note.refund_amount))}</dd>
              </div>
            )}
          </dl>

          <p className="mt-10 border-t border-zinc-200 pt-4 text-[11px] text-zinc-400">
            Issued{note.created_by ? ` by ${note.created_by}` : ""}. Computer-generated document — no signature or stamp required.
          </p>
        </div>
      </Card>
    </div>
  );
}
