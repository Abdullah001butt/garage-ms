import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";
import { EmptyState, PageHeader, Panel, SecondaryButton, tdClass, thClass, theadClass } from "@/components/ui";
import { MonthSwitcher, StatStrip, pctChange } from "@/components/report-ui";
import { currentMonth, monthBounds, monthLabel, shiftMonth } from "@/lib/salary";
import { isoBounds } from "@/lib/date-range";
import { formatAed } from "@/lib/format";

const PARTNER_COLORS = ["bg-zinc-900", "bg-brand-600", "bg-[#2a78d6]", "bg-[#eb6834]", "bg-emerald-600", "bg-amber-500"];

async function monthTotals(month: string) {
  const supabase = await createClient();
  const { start, end } = monthBounds(month);
  const bounds = isoBounds(start, end);
  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase.from("payments").select("amount").gte("paid_at", bounds.start).lte("paid_at", bounds.end),
    supabase.from("expenses").select("amount").gte("expense_date", start).lte("expense_date", end),
  ]);
  const revenue = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const costs = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  return { revenue, costs, net: revenue - costs };
}

export default async function PartnerProfitReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();
  const prevMonth = shiftMonth(month, -1);

  const supabase = await createClient();
  const [{ data: partners }, now, prev] = await Promise.all([
    supabase.from("partners").select("*").order("created_at").returns<Partner[]>(),
    monthTotals(month),
    monthTotals(prevMonth),
  ]);
  const totalShare = (partners ?? []).reduce((s, p) => s + Number(p.share_percentage), 0);
  const vs = `vs ${monthLabel(prevMonth).split(" ")[0]}`;

  return (
    <div className="page">
      <Link href="/partners" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to partners
      </Link>
      <PageHeader
        title="Partner Profit Split"
        description={`Net profit shared by each partner's percentage · ${monthLabel(month)}`}
        action={
          <>
            <MonthSwitcher
              label={monthLabel(month)}
              prevHref={`/reports/partners?month=${prevMonth}`}
              nextHref={`/reports/partners?month=${shiftMonth(month, 1)}`}
              thisHref="/reports/partners"
              isCurrent={month === currentMonth()}
            />
            <Link href="/partners">
              <SecondaryButton type="button" icon="user">
                Manage partners
              </SecondaryButton>
            </Link>
          </>
        }
      />

      <StatStrip
        className="mb-6"
        items={[
          { label: "Revenue received", value: formatAed(now.revenue), delta: pctChange(now.revenue, prev.revenue), deltaLabel: vs },
          { label: "Expenses", value: formatAed(now.costs), delta: pctChange(now.costs, prev.costs), invertDelta: true, deltaLabel: vs },
          { label: "Net profit to share", value: formatAed(now.net), tone: now.net >= 0 ? "positive" : "negative", delta: pctChange(now.net, prev.net), deltaLabel: vs },
        ]}
      />

      {(partners?.length ?? 0) === 0 ? (
        <Panel title="Partners">
          <EmptyState icon="user" message="No partners set up yet. Add them on the Partners page." />
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title="Split by partner" count={partners!.length}>
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Partner</th>
                    <th className={`${thClass} w-[40%] hidden sm:table-cell`}>Share</th>
                    <th className={`${thClass} text-right`}>This month</th>
                    <th className={`${thClass} hidden text-right md:table-cell`}>{monthLabel(prevMonth).split(" ")[0]}</th>
                  </tr>
                </thead>
                <tbody>
                  {partners!.map((p, i) => {
                    const share = Number(p.share_percentage) / 100;
                    return (
                      <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                        <td className={tdClass}>
                          <span className="flex items-center gap-2.5">
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${PARTNER_COLORS[i % PARTNER_COLORS.length]}`} />
                            <span className="font-medium text-zinc-900">{p.full_name}</span>
                          </span>
                          <span className="ml-5 text-xs text-zinc-500 sm:hidden">{p.share_percentage}% share</span>
                        </td>
                        <td className={`${tdClass} hidden sm:table-cell`}>
                          <span className="flex items-center gap-3">
                            <span className="h-1.5 flex-1 rounded-full bg-zinc-100">
                              <span className={`block h-1.5 rounded-full ${PARTNER_COLORS[i % PARTNER_COLORS.length]}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
                            </span>
                            <span className="w-10 text-right text-[13px] font-medium tabular text-zinc-700">{p.share_percentage}%</span>
                          </span>
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-right font-semibold tabular ${now.net * share < 0 ? "text-red-700" : "text-zinc-900"}`}>{formatAed(now.net * share)}</td>
                        <td className={`${tdClass} hidden whitespace-nowrap text-right tabular text-zinc-500 md:table-cell`}>{formatAed(prev.net * share)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-50 font-semibold text-zinc-900">
                    <td className="px-4 py-3">Total</td>
                    <td className="hidden px-4 py-3 text-right text-[13px] tabular sm:table-cell">
                      <span className={Math.abs(totalShare - 100) > 0.01 ? "text-amber-700" : ""}>{totalShare}%</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular">{formatAed(now.net * (totalShare / 100))}</td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular text-zinc-500 md:table-cell">{formatAed(prev.net * (totalShare / 100))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          <Panel title="How the profit is split">
            <div className="space-y-4 p-4">
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-zinc-100">
                {partners!.map((p, i) => (
                  <div key={p.id} className={PARTNER_COLORS[i % PARTNER_COLORS.length]} style={{ width: `${Number(p.share_percentage)}%` }} title={`${p.full_name} ${p.share_percentage}%`} />
                ))}
              </div>
              <ul className="space-y-2 text-[13px]">
                {partners!.map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-zinc-700">
                      <span className={`h-2 w-2 shrink-0 rounded-sm ${PARTNER_COLORS[i % PARTNER_COLORS.length]}`} />
                      <span className="truncate">{p.full_name}</span>
                    </span>
                    <span className="tabular text-zinc-500">{p.share_percentage}%</span>
                  </li>
                ))}
              </ul>
              {Math.abs(totalShare - 100) > 0.01 && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Shares add up to {totalShare}%, not 100%. Adjust them on the Partners page.
                </p>
              )}
              <p className="border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">
                Net profit = payments received this month minus expenses recorded this month (cash basis).
              </p>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
