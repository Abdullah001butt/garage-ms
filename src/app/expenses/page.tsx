import { Icon } from "@/components/icons";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Expense, CompanyVehicle } from "@/lib/types";
import { createExpense, updateExpense, deleteExpense, ensureMonthlyExpensesGenerated } from "@/app/expenses/actions";
import { Card, PageHeader, EmptyState, PrimaryButton, SecondaryButton, Field, labelClass, inputClass } from "@/components/ui";
import { SlideOver } from "@/components/SlideOver";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Tools & Equipment", "Marketing", "Other"];

export default async function ExpensesPage() {
  await ensureMonthlyExpensesGenerated();
  const supabase = await createClient();
  const [{ data: expenses, error }, { data: companyVehicles }] = await Promise.all([
    supabase.from("expenses").select("*").order("expense_date", { ascending: false }).returns<Expense[]>(),
    supabase.from("company_vehicles").select("*").order("name").returns<CompanyVehicle[]>(),
  ]);
  const vehicleNameById = new Map((companyVehicles ?? []).map((v) => [v.id, v.name]));

  const now = new Date();
  const monthTotal = (expenses ?? [])
    .filter((e) => {
      const d = new Date(e.expense_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="page">
      <PageHeader
        title="Expenses"
        description={`This month: AED ${monthTotal.toFixed(2)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/expenses/export">
              <SecondaryButton type="button" icon="download">Export</SecondaryButton>
            </a>
            <Link href="/expenses/templates">
              <SecondaryButton type="button" icon="clock">Recurring</SecondaryButton>
            </Link>
            <SlideOver title="Record an expense" description="Rent, utilities, parts or any other shop cost." triggerLabel="Record Expense">
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
                {companyVehicles && companyVehicles.length > 0 && (
                  <label className="block col-span-full">
                    <span className={labelClass}>Company Vehicle (optional)</span>
                    <select name="company_vehicle_id" className={inputClass}>
                      <option value="">None</option>
                      {companyVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="col-span-full">
                  <PrimaryButton type="submit">Save Expense</PrimaryButton>
                </div>
              </form>
            </SlideOver>
          </div>
        }
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load expenses: {error.message}</p>}

      <Card className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
              <th className="px-4 py-2.5 print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {expenses?.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2.5 text-zinc-500">
                  {new Date(e.expense_date).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 font-medium text-zinc-900">{e.category}</td>
                <td className="px-4 py-2.5 text-zinc-500">
                  {e.description ?? "—"}
                  {e.company_vehicle_id && vehicleNameById.get(e.company_vehicle_id) && (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-zinc-500">
                      <Icon name="car" className="h-3.5 w-3.5" />
                      {vehicleNameById.get(e.company_vehicle_id)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {Number(e.amount).toFixed(2)}
                </td>
                <td className="relative px-4 py-2.5 text-right print:hidden">
                  <div className="relative inline-flex items-center gap-2">
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 hover:decoration-zinc-600">Edit</summary>
                      <form
                        action={updateExpense.bind(null, e.id)}
                        className="absolute right-0 z-10 mt-2 w-64 space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-md"
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
                        {companyVehicles && companyVehicles.length > 0 && (
                          <label className="block">
                            <span className={labelClass}>Company Vehicle (optional)</span>
                            <select name="company_vehicle_id" defaultValue={e.company_vehicle_id ?? ""} className={inputClass}>
                              <option value="">None</option>
                              {companyVehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <button
                          type="submit"
                          className="w-full rounded-md border border-zinc-300 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50 px-2 py-1 text-xs font-medium"
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

    </div>
  );
}
