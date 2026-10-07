import { createClient } from "@/lib/supabase/server";
import type { DailyCashReconciliation } from "@/lib/types";
import { saveCashReconciliation } from "@/app/reports/daily-cashflow/actions";
import { Alert, Field, PageHeader, Panel, PanelEmpty, PrimaryButton, SecondaryButton, tdClass, thClass, theadClass } from "@/components/ui";
import { DateJump, MonthSwitcher, StatStrip } from "@/components/report-ui";
import { addDays, isoBounds } from "@/lib/date-range";
import { dayKey, formatAed, formatTime, formatWeekdayDate } from "@/lib/format";

type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  invoices: {
    job_card_id: string | null;
    customers: { name: string } | null;
    job_cards: {
      description: string;
      vehicles: { plate_number: string; make: string | null; model: string | null } | null;
    } | null;
  } | null;
};

type ExpenseRow = { id: string; category: string; description: string | null; amount: number };

const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", bank_transfer: "Bank transfer", ziina: "Ziina", other: "Other" };

export default async function DailyCashflowPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const today = dayKey(new Date());
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : today;
  const { start, end } = isoBounds(selectedDate, selectedDate);

  const supabase = await createClient();
  const [{ data: payments, error: paymentsError }, { data: expenses, error: expensesError }, { data: reconciliation }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, invoices(job_card_id, customers(name), job_cards(description, vehicles(plate_number, make, model)))")
      .gte("paid_at", start)
      .lte("paid_at", end)
      .order("paid_at")
      .returns<PaymentRow[]>(),
    supabase.from("expenses").select("id, category, description, amount").eq("expense_date", selectedDate).returns<ExpenseRow[]>(),
    supabase.from("daily_cash_reconciliations").select("*").eq("reconciliation_date", selectedDate).maybeSingle<DailyCashReconciliation>(),
  ]);

  const totalIn = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalOut = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const net = totalIn - totalOut;
  const byMethod = new Map<string, number>();
  for (const p of payments ?? []) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Number(p.amount));
  const cashIn = byMethod.get("cash") ?? 0;
  const expectedCash = cashIn - totalOut;
  const difference = reconciliation ? reconciliation.counted_cash - expectedCash : null;

  return (
    <div className="page">
      <PageHeader
        title="Daily Cash Flow"
        description={`Money in and out · ${formatWeekdayDate(selectedDate)}`}
        action={
          <>
            <MonthSwitcher
              label={formatWeekdayDate(selectedDate)}
              prevHref={`/reports/daily-cashflow?date=${addDays(selectedDate, -1)}`}
              nextHref={`/reports/daily-cashflow?date=${addDays(selectedDate, 1)}`}
              thisHref="/reports/daily-cashflow"
              thisLabel="Today"
              isCurrent={selectedDate === today}
            >
              <DateJump basePath="/reports/daily-cashflow" value={selectedDate} />
            </MonthSwitcher>
            <a href={`/reports/daily-cashflow/export?date=${selectedDate}`}>
              <SecondaryButton type="button" icon="download">
                Export day
              </SecondaryButton>
            </a>
            <a href={`/reports/monthly-summary/export?month=${selectedDate.slice(0, 7)}`}>
              <SecondaryButton type="button" icon="download">
                Month summary
              </SecondaryButton>
            </a>
          </>
        }
      />

      {(paymentsError || expensesError) && <p className="mb-4 text-sm text-red-600">Failed to load: {paymentsError?.message || expensesError?.message}</p>}

      <StatStrip
        className="mb-6"
        items={[
          {
            label: "Money in",
            value: formatAed(totalIn),
            tone: "positive",
            hint: byMethod.size ? [...byMethod.entries()].map(([m, v]) => `${METHOD_LABEL[m] ?? m} ${formatAed(v, 0)}`).join(" · ") : "No payments",
          },
          { label: "Money out", value: formatAed(totalOut), tone: totalOut > 0 ? "negative" : "default", hint: `${expenses?.length ?? 0} expenses` },
          { label: "Net for the day", value: formatAed(net), tone: net >= 0 ? "default" : "negative" },
          { label: "Expected in cash drawer", value: formatAed(expectedCash), hint: "Cash received − expenses" },
        ]}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Panel title="Money in" count={payments?.length ?? 0} action={<span className="font-medium tabular text-emerald-700">{formatAed(totalIn)}</span>}>
            {(payments?.length ?? 0) === 0 ? (
              <PanelEmpty message="No payments received this day." />
            ) : (
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Customer / vehicle</th>
                    <th className={`${thClass} hidden sm:table-cell`}>Method</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments!.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                      <td className={tdClass}>
                        <p className="font-medium text-zinc-900">{p.invoices?.customers?.name ?? "—"}</p>
                        <p className="text-xs text-zinc-500">
                          {[formatTime(p.paid_at), p.invoices?.job_cards?.vehicles?.plate_number, p.invoices?.job_cards?.description].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className={`${tdClass} hidden text-zinc-600 sm:table-cell`}>{METHOD_LABEL[p.method] ?? p.method}</td>
                      <td className={`${tdClass} whitespace-nowrap text-right font-medium tabular text-zinc-900`}>{formatAed(Number(p.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Money out" count={expenses?.length ?? 0} action={<span className="font-medium tabular text-red-700">{formatAed(totalOut)}</span>}>
            {(expenses?.length ?? 0) === 0 ? (
              <PanelEmpty message="No expenses recorded this day." />
            ) : (
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Expense</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses!.map((e) => (
                    <tr key={e.id} className="border-b border-zinc-100 last:border-0">
                      <td className={tdClass}>
                        <p className="font-medium text-zinc-900">{e.category}</p>
                        {e.description && <p className="text-xs text-zinc-500">{e.description}</p>}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right font-medium tabular text-zinc-900`}>{formatAed(Number(e.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <Panel title="Cash drawer check">
          <div className="space-y-4 p-4">
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Cash received</dt>
                <dd className="tabular text-zinc-900">{formatAed(cashIn)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Expenses paid</dt>
                <dd className="tabular text-zinc-900">− {formatAed(totalOut)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-1.5 font-semibold">
                <dt className="text-zinc-900">Should be in drawer</dt>
                <dd className="tabular text-zinc-900">{formatAed(expectedCash)}</dd>
              </div>
            </dl>
            {reconciliation && difference !== null && (
              <Alert tone={Math.abs(difference) < 0.01 ? "success" : "danger"} title={Math.abs(difference) < 0.01 ? "Cash matches" : `Short / over by ${formatAed(difference)}`}>
                Counted {formatAed(reconciliation.counted_cash)}
                {reconciliation.notes ? ` · ${reconciliation.notes}` : ""}
              </Alert>
            )}
            <form action={saveCashReconciliation} className="space-y-3">
              <input type="hidden" name="reconciliation_date" value={selectedDate} />
              <Field label="Cash counted in drawer (AED)" name="counted_cash" type="number" step="0.01" defaultValue={reconciliation?.counted_cash ?? ""} required />
              <Field label="Notes" name="notes" defaultValue={reconciliation?.notes ?? ""} placeholder="Optional" />
              <PrimaryButton type="submit" icon="check" className="w-full">
                {reconciliation ? "Update count" : "Save count"}
              </PrimaryButton>
            </form>
          </div>
        </Panel>
      </div>
    </div>
  );
}
