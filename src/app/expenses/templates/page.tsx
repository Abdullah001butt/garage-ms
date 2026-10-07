import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseTemplate } from "@/lib/types";
import { createTemplate, toggleTemplateActive, deleteTemplate } from "@/app/expenses/templates/actions";
import { Badge, EmptyState, Field, PageHeader, Panel, PrimaryButton, inputClass, labelClass, tdClass, thClass, theadClass } from "@/components/ui";
import { StatStrip } from "@/components/report-ui";
import { SlideOver } from "@/components/SlideOver";
import { RowMenu, RowMenuAction, RowMenuDelete, RowMenuSeparator } from "@/components/RowMenu";
import { formatAed } from "@/lib/format";

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Parts & Supplies", "Tools & Equipment", "Marketing", "Other"];

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export default async function ExpenseTemplatesPage() {
  const supabase = await createClient();
  const { data: templates, error } = await supabase.from("expense_templates").select("*").order("day_of_month").returns<ExpenseTemplate[]>();

  const active = (templates ?? []).filter((t) => t.active);
  const monthly = active.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="page">
      <Link href="/expenses" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to expenses
      </Link>
      <PageHeader
        title="Recurring Expenses"
        description="Bills that repeat every month (rent, utilities…) are added to Expenses automatically on their day."
        action={
          <SlideOver title="New recurring expense" description="Added to Expenses automatically each month on the chosen day." triggerLabel="New recurring expense">
            <form action={createTemplate} className="space-y-4">
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
              <Field label="Description" name="description" placeholder="e.g. Workshop rent" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount (AED)" name="amount" type="number" step="0.01" required />
                <Field label="Day of month" name="day_of_month" type="number" defaultValue={1} required />
              </div>
              <PrimaryButton type="submit" className="w-full">
                Create recurring expense
              </PrimaryButton>
            </form>
          </SlideOver>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">Failed to load templates: {error.message}</p>}

      <StatStrip
        className="mb-6"
        items={[
          { label: "Every month", value: formatAed(monthly), hint: "Active recurring costs" },
          { label: "Active", value: String(active.length), tone: "positive" },
          { label: "Paused", value: String((templates?.length ?? 0) - active.length) },
        ]}
      />

      <Panel title="Recurring expenses" count={templates?.length ?? 0}>
        {(templates?.length ?? 0) === 0 ? (
          <EmptyState icon="clock" message="No recurring expenses yet. Add rent or other fixed monthly bills." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Expense</th>
                  <th className={`${thClass} hidden sm:table-cell`}>Repeats</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} hidden md:table-cell`}>Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {templates!.map((t) => (
                  <tr key={t.id} className={`border-b border-zinc-100 last:border-0 ${t.active ? "" : "opacity-60"}`}>
                    <td className={tdClass}>
                      <p className="font-medium text-zinc-900">{t.description || t.category}</p>
                      <p className="text-xs text-zinc-500">
                        {t.category}
                        <span className="sm:hidden"> · {ordinal(t.day_of_month)} of month</span>
                      </p>
                    </td>
                    <td className={`${tdClass} hidden text-zinc-600 sm:table-cell`}>Every month on the {ordinal(t.day_of_month)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right font-medium tabular text-zinc-900`}>{formatAed(Number(t.amount))}</td>
                    <td className={`${tdClass} hidden md:table-cell`}>
                      <Badge color={t.active ? "green" : "gray"} dot>
                        {t.active ? "Active" : "Paused"}
                      </Badge>
                    </td>
                    <td className="pr-3 text-right">
                      <RowMenu>
                        <RowMenuAction action={toggleTemplateActive.bind(null, t.id, !t.active)} icon={t.active ? "clock" : "check"} successMessage={t.active ? "Paused." : "Resumed."}>
                          {t.active ? "Pause" : "Resume"}
                        </RowMenuAction>
                        <RowMenuSeparator />
                        <RowMenuDelete action={deleteTemplate.bind(null, t.id)} confirmMessage="Remove this recurring expense? Past expenses stay." successMessage="Recurring expense removed." label="Remove" />
                      </RowMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 text-[13px] font-semibold text-zinc-900">
                  <td className="px-4 py-3">Active total per month</td>
                  <td className="hidden sm:table-cell" />
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular">{formatAed(monthly)}</td>
                  <td className="hidden md:table-cell" />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
