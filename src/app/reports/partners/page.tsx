import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";
import { Card, PageHeader, StatCard, EmptyState } from "@/components/ui";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PartnerProfitReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthValue = month || currentMonthValue();
  const [year, mon] = monthValue.split("-").map(Number);
  const monthStart = `${monthValue}-01`;
  const nextMonth = new Date(year, mon, 1).toISOString().slice(0, 10);

  const supabase = await createClient();

  const { data: partners } = await supabase
    .from("partners")
    .select("*")
    .order("created_at")
    .returns<Partner[]>();

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .gte("paid_at", monthStart)
    .lt("paid_at", nextMonth);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .gte("expense_date", monthStart)
    .lt("expense_date", nextMonth);

  const totalRevenue = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href="/partners" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to partners
      </Link>
      <PageHeader title="Partner Profit Split" description="Net profit shared by each partner's percentage." />

      <Card className="p-4 mb-6">
        <form className="flex items-end gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">Month</span>
            <input
              type="month"
              name="month"
              defaultValue={monthValue}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            View
          </button>
        </form>
      </Card>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Revenue" value={`AED ${totalRevenue.toFixed(2)}`} accent="green" />
        <StatCard label="Expenses" value={`AED ${totalExpenses.toFixed(2)}`} accent="red" />
        <StatCard label="Net Profit" value={`AED ${netProfit.toFixed(2)}`} accent={netProfit >= 0 ? "indigo" : "red"} />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Partner</th>
              <th className="px-4 py-2.5 font-medium text-right">Share %</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {partners?.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{p.full_name}</td>
                <td className="px-4 py-2.5 text-right">{p.share_percentage}%</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  AED {(netProfit * (Number(p.share_percentage) / 100)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {partners?.length === 0 && (
          <EmptyState message="No partners set up yet. Add them on the Partners page." />
        )}
      </Card>
    </div>
  );
}
