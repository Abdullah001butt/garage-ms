import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Expense } from "@/lib/types";
import { createExpense, updateExpense, deleteExpense, ensureMonthlyExpensesGenerated } from "@/app/expenses/actions";
import { Card, PageHeader, EmptyState, PrimaryButton, SecondaryButton, Field, labelClass, inputClass } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Tools & Equipment", "Marketing", "Other"];

export default async function ExpensesPage() {
  await ensureMonthlyExpensesGenerated();
  const supabase = await createClient();
  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .returns<Expense[]>();

  const now = new Date();
  const monthTotal = (expenses ?? [])
    .filter((e) => {
      const d = new Date(e.expense_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Expenses"
        description={`This month: AED ${monthTotal.toFixed(2)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/expenses/export">
              <SecondaryButton type="button">Export Excel</SecondaryButton>
            </a>
            <Link href="/expenses/templates">
              <SecondaryButton type="button">Recurring Templates</SecondaryButton>
            </Link>
          </div>
        }
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load expenses: {error.message}</p>}

      <Card className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
              <th className="px-4 py-2.5 print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses?.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2.5 text-slate-500">
                  {new Date(e.expense_date).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{e.category}</td>
                <td className="px-4 py-2.5 text-slate-500">{e.description ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {Number(e.amount).toFixed(2)}
                </td>
                <td className="relative px-4 py-2.5 text-right print:hidden">
                  <div className="relative inline-flex items-center gap-2">
                    <details>
                      <summary className="cursor-pointer text-xs text-indigo-600 hover:underline">Edit</summary>
                      <form
                        action={updateExpense.bind(null, e.id)}
                        className="absolute right-0 z-10 mt-2 w-64 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-md"
                      >
                        <label className="block">
                          <span className={labelClass}>Category</span>
                          <select name="category" defaultValue={e.category} required className={inputClass}>
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Field label="Date" name="expense_date" type="date" defaultValue={e.expense_date} required />
                        <Field label="Amount (AED)" name="amount" type="number" step="0.01" defaultValue={e.amount} required />
                        <Field label="Description" name="description" defaultValue={e.description ?? ""} />
                        <button
                          type="submit"
                          className="w-full rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          Save
                        </button>
                      </form>
                    </details>
                    <ConfirmSubmitButton
                      action={deleteExpense.bind(null, e.id)}
                      confirmMessage="Delete this expense? This cannot be undone."
                      successMessage="Expense deleted."
                    >
                      Remove
                    </ConfirmSubmitButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses?.length === 0 && <EmptyState message="No expenses recorded yet." />}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">Record an expense</p>
        <form action={createExpense} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className={labelClass}>Category</span>
            <select name="category" required className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <Field label="Date" name="expense_date" type="date" required />
          <Field label="Amount (AED)" name="amount" type="number" step="0.01" required />
          <Field label="Description" name="description" />
          <div className="col-span-2">
            <PrimaryButton type="submit">Save Expense</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
