import type { ReactNode } from "react";
import { computeProfitLoss } from "@/lib/profit-loss";
import { Alert, PageHeader, Panel, PanelEmpty, SecondaryButton } from "@/components/ui";
import { MonthSwitcher, StatStrip, pctChange } from "@/components/report-ui";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/salary";
import { formatAed } from "@/lib/format";

function Line({ label, value, indent = false, negative = false, strong = false, border = false }: { label: ReactNode; value: number; indent?: boolean; negative?: boolean; strong?: boolean; border?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-5 py-2.5 text-sm ${border ? "border-t border-zinc-200" : ""} ${
        strong ? "bg-zinc-50 font-semibold text-zinc-900" : "text-zinc-700"
      }`}
    >
      <span className={indent ? "pl-4 text-zinc-500" : ""}>{label}</span>
      <span className={`whitespace-nowrap tabular ${negative && value > 0 ? "text-red-700" : ""} ${strong && value < 0 ? "text-red-700" : ""}`}>
        {negative && value > 0 ? `(${formatAed(value)})` : formatAed(value)}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="border-t border-zinc-200 px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500 first:border-t-0">{children}</p>;
}

export default async function ProfitLossPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();
  const prevMonth = shiftMonth(month, -1);
  const [pl, prev] = await Promise.all([computeProfitLoss(month), computeProfitLoss(prevMonth)]);
  const vsLabel = `vs ${monthLabel(prevMonth).split(" ")[0]}`;
  const maxExpense = Math.max(1, ...pl.expensesByCategory.map((e) => e.amount));

  return (
    <div className="page">
      <PageHeader
        title="Profit & Loss"
        description={`Income statement · ${monthLabel(month)}`}
        action={
          <>
            <MonthSwitcher
              label={monthLabel(month)}
              prevHref={`/reports/profit-loss?month=${prevMonth}`}
              nextHref={`/reports/profit-loss?month=${shiftMonth(month, 1)}`}
              thisHref="/reports/profit-loss"
              isCurrent={month === currentMonth()}
            />
            <a href={`/reports/profit-loss/export?month=${month}`}>
              <SecondaryButton type="button" icon="download">
                Export
              </SecondaryButton>
            </a>
          </>
        }
      />

      <StatStrip
        className="mb-6"
        items={[
          { label: "Net revenue", value: formatAed(pl.netRevenue, 0), delta: pctChange(pl.netRevenue, prev.netRevenue), deltaLabel: vsLabel },
          { label: "Gross profit", value: formatAed(pl.grossProfit, 0), hint: `${pl.grossMarginPct.toFixed(1)}% margin`, delta: pctChange(pl.grossProfit, prev.grossProfit) },
          { label: "Operating expenses", value: formatAed(pl.totalExpenses, 0), delta: pctChange(pl.totalExpenses, prev.totalExpenses), invertDelta: true, deltaLabel: vsLabel },
          {
            label: "Net profit",
            value: formatAed(pl.netProfit, 0),
            tone: pl.netProfit >= 0 ? "positive" : "negative",
            hint: `${pl.netMarginPct.toFixed(1)}% margin`,
            delta: pctChange(pl.netProfit, prev.netProfit),
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Income statement" action={<span className="text-xs text-zinc-500">{pl.invoiceCount} invoices</span>}>
          <SectionTitle>Revenue</SectionTitle>
          <Line label="Labour income" value={pl.laborIncome} indent />
          {pl.serviceIncome > 0 && <Line label="Service income (towing, recovery…)" value={pl.serviceIncome} indent />}
          <Line label="Parts sales" value={pl.partsRevenue} indent />
          <Line label="Discounts given" value={pl.totalDiscount} indent negative />
          <Line label="Net revenue" value={pl.netRevenue} strong border />

          <SectionTitle>Cost of sales</SectionTitle>
          <Line label="Parts cost (COGS)" value={pl.partsCost} indent negative />
          {pl.subletCosts > 0 && <Line label="Sublet / outsourced work" value={pl.subletCosts} indent negative />}
          <Line label={<>Gross profit <span className="font-normal text-zinc-500">· {pl.grossMarginPct.toFixed(1)}%</span></>} value={pl.grossProfit} strong border />

          <SectionTitle>Operating expenses</SectionTitle>
          {pl.expensesByCategory.length === 0 && <p className="px-5 py-2.5 pl-9 text-sm text-zinc-400">No expenses recorded this month.</p>}
          {pl.expensesByCategory.map((e) => (
            <Line key={e.category} label={e.category} value={e.amount} indent negative />
          ))}
          <Line label="Total operating expenses" value={pl.totalExpenses} strong border />

          <div className={`flex items-baseline justify-between gap-4 border-t-2 border-zinc-900 px-5 py-4 ${pl.netProfit >= 0 ? "bg-emerald-50/60" : "bg-red-50/60"}`}>
            <span className="text-base font-semibold text-zinc-900">
              Net profit <span className="text-sm font-normal text-zinc-500">· {pl.netMarginPct.toFixed(1)}% margin</span>
            </span>
            <span className={`whitespace-nowrap text-lg font-semibold tabular ${pl.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatAed(pl.netProfit)}</span>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Where the money went">
            {pl.expensesByCategory.length === 0 ? (
              <PanelEmpty message="No expenses this month." />
            ) : (
              <ul className="space-y-3 p-4">
                {[...pl.expensesByCategory]
                  .sort((a, b) => b.amount - a.amount)
                  .map((e) => (
                    <li key={e.category}>
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="font-medium text-zinc-700">{e.category}</span>
                        <span className="tabular text-zinc-900">
                          {formatAed(e.amount, 0)}
                          <span className="ml-1.5 text-zinc-400">{pl.totalExpenses ? Math.round((e.amount / pl.totalExpenses) * 100) : 0}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100">
                        <div className="h-1.5 rounded-full bg-[#eb6834]" style={{ width: `${(e.amount / maxExpense) * 100}%` }} />
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Compared with ${monthLabel(prevMonth)}`}>
            <dl className="divide-y divide-zinc-100 text-[13px]">
              {[
                ["Net revenue", pl.netRevenue, prev.netRevenue],
                ["Gross profit", pl.grossProfit, prev.grossProfit],
                ["Expenses", pl.totalExpenses, prev.totalExpenses],
                ["Net profit", pl.netProfit, prev.netProfit],
              ].map(([label, now, before]) => (
                <div key={label as string} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-4 px-4 py-2.5">
                  <dt className="text-zinc-600">{label}</dt>
                  <dd className="tabular text-zinc-400">{formatAed(before as number, 0)}</dd>
                  <dd className="w-28 text-right font-medium tabular text-zinc-900">{formatAed(now as number, 0)}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {pl.unlinkedPartsRevenue > 0 && (
            <Alert tone="warning" title="Some parts have no cost price">
              {formatAed(pl.unlinkedPartsRevenue)} of parts sales aren&apos;t linked to a stock item, so their cost isn&apos;t in COGS. Pick parts from stock on invoices for an exact margin.
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
