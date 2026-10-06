import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Expense, CompanyVehicle } from "@/lib/types";
import { createExpense, updateExpense, deleteExpense, ensureMonthlyExpensesGenerated } from "@/app/expenses/actions";
import { Card, PageHeader, EmptyState, PrimaryButton, SecondaryButton, Field, labelClass, inputClass } from "@/components/ui";
import { RowMenu, RowMenuDelete, RowMenuOpenPanel, RowMenuSeparator } from "@/components/RowMenu";
import { SlideOver } from "@/components/SlideOver";

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Tools & Equipment", "Marketing", "Other"];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: newParam } = await searchParams;
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
            <SlideOver title="Record an expense" description="Rent, utilities, parts or any other shop cost." triggerLabel="Record Expense" defaultOpen={newParam === "1"}>
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
                  {formatDate(e.expense_date)}
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
                    <SlideOver id={`edit-expense-${e.id}`} hideTrigger title="Edit expense" description="Update the category, date or amount." triggerLabel="Edit">
                      <form action={updateExpense.bind(null, e.id)} className="space-y-4">
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
                        <PrimaryButton type="submit" className="w-full">Save changes</PrimaryButton>
                      </form>
                    </SlideOver>
                    <RowMenu>
                      <RowMenuOpenPanel panelId={`edit-expense-${e.id}`} icon="pencil">Edit expense</RowMenuOpenPanel>
                      <RowMenuSeparator />
                      <RowMenuDelete action={deleteExpense.bind(null, e.id)} confirmMessage="Delete this expense? This cannot be undone." successMessage="Expense deleted." label="Delete" />
                    </RowMenu>
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
