import { createClient } from "@/lib/supabase/server";
import type { DailyCashReconciliation } from "@/lib/types";
import { saveCashReconciliation } from "@/app/reports/daily-cashflow/actions";
import { Card, PageHeader, StatCard, SecondaryButton, PrimaryButton, Field, EmptyState, Alert } from "@/components/ui";

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

type ExpenseRow = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DailyCashflowPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const selectedDate = date || today();

  const supabase = await createClient();

  const [
    { data: payments, error: paymentsError },
    { data: expenses, error: expensesError },
    { data: reconciliation },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, amount, method, paid_at, invoices(job_card_id, customers(name), job_cards(description, vehicles(plate_number, make, model)))"
      )
      .gte("paid_at", `${selectedDate}T00:00:00`)
      .lte("paid_at", `${selectedDate}T23:59:59`)
      .returns<PaymentRow[]>(),
    supabase
      .from("expenses")
      .select("id, category, description, amount")
      .eq("expense_date", selectedDate)
      .returns<ExpenseRow[]>(),
    supabase
      .from("daily_cash_reconciliations")
      .select("*")
      .eq("reconciliation_date", selectedDate)
      .maybeSingle<DailyCashReconciliation>(),
  ]);

  const totalIn = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalOut = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const net = totalIn - totalOut;

  const cashIn = (payments ?? []).filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount), 0);
  const expectedCash = cashIn - totalOut;
  const difference = reconciliation ? reconciliation.counted_cash - expectedCash : null;

  return (
    <div className="page">
      <PageHeader
        title="Daily Cash Flow"
        description="Cash in (payments received) and out (expenses) for a single day."
        action={
          <div className="flex flex-wrap gap-2">
            <a href={`/reports/monthly-summary/export?month=${selectedDate.slice(0, 7)}`}>
              <SecondaryButton type="button">Export Month Summary (Excel)</SecondaryButton>
            </a>
            <a href={`/reports/daily-cashflow/export?date=${selectedDate}`}>
              <SecondaryButton type="button">Export Day (Excel)</SecondaryButton>
            </a>
          </div>
        }
      />

      <Card className="p-4 mb-6">
        <form className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-700 mb-1">Date</span>
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
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

      {(paymentsError || expensesError) && (
        <p className="text-red-600 text-sm mb-4">
          Failed to load: {paymentsError?.message || expensesError?.message}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Cash In" value={`AED ${totalIn.toFixed(2)}`} accent="green" />
        <StatCard label="Cash Out" value={`AED ${totalOut.toFixed(2)}`} accent="red" />
        <StatCard label="Net" value={`AED ${net.toFixed(2)}`} accent={net >= 0 ? "indigo" : "red"} />
      </div>

      <Card className="p-5 mb-6">
        <p className="text-sm font-semibold text-zinc-700 mb-1">Cash Drawer Reconciliation</p>
        <p className="text-xs text-zinc-500 mb-4">
          Expected cash = cash payments received (AED {cashIn.toFixed(2)}) minus expenses (AED {totalOut.toFixed(2)}) = AED{" "}
          {expectedCash.toFixed(2)}. Enter what was actually counted in the drawer at end of day.
        </p>
        {reconciliation && difference !== null && (
          <Alert
            className="mb-4"
            tone={Math.abs(difference) < 0.01 ? "success" : "danger"}
            title={Math.abs(difference) < 0.01 ? "Cash matches — no discrepancy" : "Cash mismatch"}
          >
            {Math.abs(difference) >= 0.01 &&
              `Counted AED ${reconciliation.counted_cash.toFixed(2)} vs expected AED ${expectedCash.toFixed(2)} (${
                difference > 0 ? "+" : ""
              }AED ${difference.toFixed(2)})`}
          </Alert>
        )}
        <form action={saveCashReconciliation} className="flex flex-wrap items-end gap-4">
          <input type="hidden" name="reconciliation_date" value={selectedDate} />
          <Field
            label="Counted Cash (AED)"
            name="counted_cash"
            type="number"
            step="0.01"
            defaultValue={reconciliation?.counted_cash ?? ""}
            required
          />
          <Field label="Notes (optional)" name="notes" defaultValue={reconciliation?.notes ?? ""} />
          <PrimaryButton type="submit">Save Reconciliation</PrimaryButton>
        </form>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 mb-2">In</h2>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Vehicle / Customer</th>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments?.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      {p.invoices?.job_cards?.vehicles?.plate_number ?? p.invoices?.customers?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{p.invoices?.job_cards?.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{Number(p.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payments?.length === 0 && <EmptyState message="No payments this day." />}
          </Card>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-zinc-700 mb-2">Out</h2>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {expenses?.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2">{e.category}</td>
                    <td className="px-3 py-2 text-zinc-500">{e.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{Number(e.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses?.length === 0 && <EmptyState message="No expenses this day." />}
          </Card>
        </div>
      </div>
    </div>
  );
}
