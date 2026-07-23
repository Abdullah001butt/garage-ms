import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, StatCard, SecondaryButton } from "@/components/ui";

type InvoiceRow = {
  id: string;
  created_at: string;
  vat_rate: number;
  customers: { name: string } | null;
  invoice_items: { quantity: number; unit_price: number }[];
};

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start, end } = await searchParams;
  const startDate = start || firstOfMonth();
  const endDate = end || today();

  const supabase = await createClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, created_at, vat_rate, customers(name), invoice_items(quantity, unit_price)")
    .eq("document_type", "invoice")
    .gte("created_at", startDate)
    .lte("created_at", `${endDate}T23:59:59`)
    .order("created_at")
    .returns<InvoiceRow[]>();

  const rows = (invoices ?? []).map((inv) => {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const vat = subtotal * (inv.vat_rate / 100);
    return { ...inv, subtotal, vat, total: subtotal + vat };
  });

  const totalSubtotal = rows.reduce((s, r) => s + r.subtotal, 0);
  const totalVat = rows.reduce((s, r) => s + r.vat, 0);
  const totalAmount = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="VAT Report"
        description="Tax collected per period, ready for filing."
        action={
          <a href={`/reports/vat/export?start=${startDate}&end=${endDate}`}>
            <SecondaryButton type="button">Export CSV</SecondaryButton>
          </a>
        }
      />

      <Card className="p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">Start date</span>
            <input
              type="date"
              name="start"
              defaultValue={startDate}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">End date</span>
            <input
              type="date"
              name="end"
              defaultValue={endDate}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Filter
          </button>
        </form>
      </Card>

      {error && <p className="text-red-600 text-sm mb-4">Failed to load: {error.message}</p>}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Net Sales" value={`AED ${totalSubtotal.toFixed(2)}`} />
        <StatCard label="VAT Collected" value={`AED ${totalVat.toFixed(2)}`} accent="indigo" />
        <StatCard label="Total Invoiced" value={`AED ${totalAmount.toFixed(2)}`} accent="green" />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium text-right">Net</th>
              <th className="px-4 py-2.5 font-medium text-right">VAT</th>
              <th className="px-4 py-2.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-slate-500">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{r.customers?.name}</td>
                <td className="px-4 py-2.5 text-right">{r.subtotal.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right">{r.vat.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{r.total.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No invoices in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
