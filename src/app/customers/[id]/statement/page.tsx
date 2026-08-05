import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, CustomerBalanceAdjustment, ShopSettings } from "@/lib/types";
import { Card, PageHeader, SecondaryButton, inputClass, labelClass } from "@/components/ui";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { DownloadStatementPdfButton } from "@/components/DownloadStatementPdfButton";

type StatementInvoiceRow = {
  id: string;
  invoice_number: number | null;
  created_at: string;
  discount: number;
  vat_rate: number;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
};

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const supabase = await createClient();

  const fromDate = from || "2000-01-01";
  const toDate = to || new Date().toISOString().slice(0, 10);

  const [{ data: customer }, { data: invoices }, { data: adjustments }, { data: settings }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single<Customer>(),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, created_at, discount, vat_rate, invoice_items(quantity, unit_price), payments(amount)"
      )
      .eq("customer_id", id)
      .eq("document_type", "invoice")
      .gte("created_at", fromDate)
      .lte("created_at", `${toDate}T23:59:59`)
      .order("created_at", { ascending: true })
      .returns<StatementInvoiceRow[]>(),
    supabase
      .from("customer_balance_adjustments")
      .select("*")
      .eq("customer_id", id)
      .gte("created_at", fromDate)
      .lte("created_at", `${toDate}T23:59:59`)
      .order("created_at", { ascending: true })
      .returns<CustomerBalanceAdjustment[]>(),
    supabase.from("shop_settings").select("*").limit(1).maybeSingle<ShopSettings>(),
  ]);

  if (!customer) notFound();

  type Row = {
    date: string;
    label: string;
    amount: number;
    paid: number;
  };

  const rows: Row[] = [
    ...(invoices ?? []).map((inv) => {
      const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const total = subtotal + subtotal * (inv.vat_rate / 100) - inv.discount;
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      return {
        date: inv.created_at,
        label: formatInvoiceNumber(inv.invoice_number, inv.created_at) ?? "Invoice",
        amount: total,
        paid,
      };
    }),
    ...(adjustments ?? []).map((a) => ({
      date: a.created_at,
      label: a.note,
      amount: Number(a.amount),
      paid: 0,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalInvoiced = rows.reduce((s, r) => s + r.amount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const balance = totalInvoiced - totalPaid;

  let running = 0;

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href={`/customers/${id}`} className="text-sm text-indigo-600 hover:underline print:hidden">
        &larr; Back to {customer.name}
      </Link>

      <PageHeader
        title="Statement of Account"
        description={customer.name}
        action={
          <div className="flex flex-wrap gap-2">
            <form className="flex items-center gap-2 print:hidden">
              <label>
                <span className={`${labelClass} sr-only`}>From</span>
                <input type="date" name="from" defaultValue={from ?? ""} className={`${inputClass} !py-1.5 text-xs`} />
              </label>
              <label>
                <span className={`${labelClass} sr-only`}>To</span>
                <input type="date" name="to" defaultValue={to ?? ""} className={`${inputClass} !py-1.5 text-xs`} />
              </label>
              <SecondaryButton type="submit">Filter</SecondaryButton>
            </form>
            <DownloadStatementPdfButton customerName={customer.name} />
          </div>
        }
      />

      <Card className="p-6 md:p-8" id="statement-printable">
        <div className="flex items-start justify-between gap-4 border-b-4 border-slate-900 pb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase text-slate-400">Statement of Account</h1>
            <div className="mt-3 flex items-center gap-3">
              <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={140} height={40} className="h-10 w-auto object-contain" />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900">{settings?.shop_name ?? "AL BAHIR VEHICLES REPAIR LLC"}</p>
            {settings?.phone && <p className="text-xs text-slate-600">Telephone [{settings.phone}]</p>}
            {settings?.address && <p className="text-xs text-slate-600">[{settings.address}]</p>}
          </div>
          <div className="shrink-0 text-right text-xs text-slate-600">
            <p className="font-semibold text-slate-900">{customer.name}</p>
            {customer.phone && <p>{customer.phone}</p>}
            {customer.address && <p>{customer.address}</p>}
            <p className="mt-2">
              Period: {new Date(fromDate).toLocaleDateString()} – {new Date(toDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-600">
              <th className="px-2 py-1.5 text-left">Date</th>
              <th className="px-2 py-1.5 text-left">Description</th>
              <th className="px-2 py-1.5 text-right">Amount</th>
              <th className="px-2 py-1.5 text-right">Paid</th>
              <th className="px-2 py-1.5 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              running += r.amount - r.paid;
              return (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-slate-600">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-2 py-1.5 text-slate-900">{r.label}</td>
                  <td className="px-2 py-1.5 text-right text-slate-900">AED {r.amount.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right text-emerald-600">
                    {r.paid > 0 ? `AED ${r.paid.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium text-slate-900">AED {running.toFixed(2)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-slate-400">
                  No transactions in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 flex flex-col sm:flex-row justify-end gap-6 border-t border-slate-300 pt-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Total Invoiced</p>
            <p className="text-sm font-bold text-slate-900">AED {totalInvoiced.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total Paid</p>
            <p className="text-sm font-bold text-emerald-600">AED {totalPaid.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Balance Due</p>
            <p className={`text-lg font-bold ${balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
              AED {balance.toFixed(2)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
