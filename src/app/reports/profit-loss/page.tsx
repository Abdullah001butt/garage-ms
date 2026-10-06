import { computeProfitLoss } from "@/lib/profit-loss";
import { Card, PageHeader, StatCard, SecondaryButton } from "@/components/ui";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthValue = month || currentMonthValue();

  const pl = await computeProfitLoss(monthValue);

  return (
    <div className="page page-narrow">
      <PageHeader
        title="Profit & Loss"
        description="True margin: labor income, parts markup, expenses, and net profit."
        action={
          <a href={`/reports/profit-loss/export?month=${monthValue}`}>
            <SecondaryButton type="button">Export Excel</SecondaryButton>
          </a>
        }
      />

      <Card className="p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-700 mb-1">Month</span>
            <input
              type="month"
              name="month"
              defaultValue={monthValue}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            View
          </button>
        </form>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Net Revenue" value={`AED ${pl.netRevenue.toFixed(0)}`} />
        <StatCard label="Gross Profit" value={`AED ${pl.grossProfit.toFixed(0)}`} hint={`${pl.grossMarginPct.toFixed(1)}% margin`} accent="indigo" />
        <StatCard
          label="Net Profit"
          value={`AED ${pl.netProfit.toFixed(0)}`}
          hint={`${pl.netMarginPct.toFixed(1)}% margin`}
          accent={pl.netProfit >= 0 ? "green" : "red"}
        />
      </div>

      <Card className="p-5 mb-6">
        <p className="text-sm font-semibold text-zinc-700 mb-4">Revenue</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Labor Income</span>
            <span className="font-medium">AED {pl.laborIncome.toFixed(2)}</span>
          </div>
          {pl.serviceIncome > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Service Income (towing, recovery, etc.)</span>
              <span className="font-medium">AED {pl.serviceIncome.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-500">Parts Revenue</span>
            <span className="font-medium">AED {pl.partsRevenue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Parts Cost (COGS)</span>
            <span className="font-medium text-red-600">-AED {pl.partsCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-zinc-100 pt-2">
            <span className="text-zinc-700 font-medium">Parts Margin</span>
            <span className="font-semibold">AED {pl.partsMargin.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Discounts Given</span>
            <span className="font-medium text-red-600">-AED {pl.totalDiscount.toFixed(2)}</span>
          </div>
          {pl.subletCosts > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Sublet / Outsourced Costs</span>
              <span className="font-medium text-red-600">-AED {pl.subletCosts.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
            <span className="font-semibold text-zinc-900">Gross Profit</span>
            <span className={`font-bold tabular ${pl.grossProfit < 0 ? "text-red-700" : "text-zinc-900"}`}>AED {pl.grossProfit.toFixed(2)}</span>
          </div>
        </div>
        {pl.unlinkedPartsRevenue > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            Note: AED {pl.unlinkedPartsRevenue.toFixed(2)} of parts revenue isn&apos;t linked to an inventory
            item, so its cost isn&apos;t included in COGS — link parts on invoices via the inventory
            picker for a more accurate margin.
          </p>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <p className="text-sm font-semibold text-zinc-700 mb-4">Operating Expenses</p>
        <div className="space-y-2 text-sm">
          {pl.expensesByCategory.map((e) => (
            <div key={e.category} className="flex justify-between">
              <span className="text-zinc-500">{e.category}</span>
              <span className="font-medium">AED {e.amount.toFixed(2)}</span>
            </div>
          ))}
          {pl.expensesByCategory.length === 0 && (
            <p className="text-sm text-zinc-400">No expenses recorded this month.</p>
          )}
          <div className="flex justify-between border-t border-zinc-200 pt-2">
            <span className="font-semibold text-zinc-900">Total Expenses</span>
            <span className="font-bold text-red-600">AED {pl.totalExpenses.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex justify-between text-lg">
          <span className="font-semibold text-zinc-900">Net Profit</span>
          <span className={`font-bold ${pl.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            AED {pl.netProfit.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          Based on {pl.invoiceCount} invoice{pl.invoiceCount === 1 ? "" : "s"} issued this month.
        </p>
      </Card>
    </div>
  );
}
