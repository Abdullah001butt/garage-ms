import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { WhatsAppButton } from "@/components/WhatsAppButton";

type DueInvoice = {
  id: string;
  created_at: string;
  vat_rate: number;
  discount: number;
  status: "unpaid" | "partial" | "paid";
  customers: { name: string; phone: string } | null;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
};

export default async function OutstandingDuesPage() {
  const supabase = await createClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      "id, created_at, vat_rate, discount, status, customers(name, phone), invoice_items(quantity, unit_price), payments(amount)"
    )
    .eq("document_type", "invoice")
    .in("status", ["unpaid", "partial"])
    .returns<DueInvoice[]>();

  const rows = (invoices ?? [])
    .map((inv) => {
      const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const vatAmount = subtotal * (inv.vat_rate / 100);
      const total = subtotal + vatAmount - inv.discount;
      const totalPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      const balanceDue = Math.max(total - totalPaid, 0);
      const daysOld = Math.floor((Date.now() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return { ...inv, balanceDue, daysOld };
    })
    .filter((r) => r.balanceDue > 0.01)
    .sort((a, b) => b.daysOld - a.daysOld);

  const totalOutstanding = rows.reduce((s, r) => s + r.balanceDue, 0);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Outstanding Dues"
        description="Every unpaid or partially paid invoice, oldest first, with one-tap reminders."
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load: {error.message}</p>}

      <Card className="mb-6 p-5">
        <p className="text-sm text-slate-500">Total outstanding</p>
        <p className="text-3xl font-bold text-slate-900">AED {totalOutstanding.toFixed(2)}</p>
        <p className="text-xs text-slate-400 mt-1">
          Across {rows.length} invoice{rows.length !== 1 ? "s" : ""}
        </p>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Invoice Date</th>
              <th className="px-4 py-2.5 font-medium text-right">Age</th>
              <th className="px-4 py-2.5 font-medium text-right">Balance Due</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const firstName = r.customers?.name?.split(" ")[0] ?? "there";
              const message = `Hi ${firstName}, this is a friendly reminder from Al Bahir Garage that you have an outstanding balance of AED ${r.balanceDue.toFixed(2)}. Please let us know if you'd like to settle it. Thank you!`;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/invoices/${r.id}`} className="font-medium text-indigo-600 hover:underline">
                      {r.customers?.name ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge color={r.daysOld > 30 ? "red" : r.daysOld > 14 ? "amber" : "green"}>
                      {r.daysOld}d
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                    AED {r.balanceDue.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-slate-500">{r.status}</td>
                  <td className="px-4 py-2.5">
                    {r.customers?.phone && (
                      <WhatsAppButton phone={r.customers.phone} message={message} label="Remind" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState message="No outstanding dues. Everything is settled!" />}
      </Card>
    </div>
  );
}
