import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseTemplate } from "@/lib/types";
import { createTemplate, toggleTemplateActive, deleteTemplate } from "@/app/expenses/templates/actions";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton, Field, labelClass, inputClass } from "@/components/ui";

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Tools & Equipment", "Marketing", "Other"];

export default async function ExpenseTemplatesPage() {
  const supabase = await createClient();
  const { data: templates, error } = await supabase
    .from("expense_templates")
    .select("*")
    .order("created_at")
    .returns<ExpenseTemplate[]>();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href="/expenses" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to expenses
      </Link>
      <PageHeader
        title="Recurring Expense Templates"
        description="Auto-generated each month (rent, salaries, etc.) so you don't re-enter them."
      />

      {error && <p className="text-red-600 text-sm mb-4">Failed to load templates: {error.message}</p>}

      <Card className="mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
              <th className="px-4 py-2.5 font-medium text-right">Day of month</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {templates?.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{t.category}</td>
                <td className="px-4 py-2.5 text-slate-500">{t.description ?? "—"}</td>
                <td className="px-4 py-2.5 text-right">{Number(t.amount).toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right">{t.day_of_month}</td>
                <td className="px-4 py-2.5">
                  <Badge color={t.active ? "green" : "gray"}>{t.active ? "Active" : "Paused"}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex gap-2 justify-end">
                    <form action={toggleTemplateActive.bind(null, t.id, !t.active)}>
                      <button className="text-xs text-indigo-600 hover:underline">
                        {t.active ? "Pause" : "Resume"}
                      </button>
                    </form>
                    <form action={deleteTemplate.bind(null, t.id)}>
                      <button className="text-xs text-red-500 hover:underline">Remove</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates?.length === 0 && <EmptyState message="No recurring templates yet." />}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">New recurring expense</p>
        <form action={createTemplate} className="grid grid-cols-2 gap-4">
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
          <Field label="Day of month" name="day_of_month" type="number" defaultValue={1} required />
          <Field label="Amount (AED)" name="amount" type="number" step="0.01" required />
          <Field label="Description" name="description" />
          <div className="col-span-2">
            <PrimaryButton type="submit">Create Template</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
