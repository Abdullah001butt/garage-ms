import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Attendance, Profile, SalaryPayment, ShopHoliday, StaffAdvance } from "@/lib/types";
import { addStaffAdvance, deleteStaffAdvance, paySalary, undoSalaryPayment } from "@/app/staff/salaries/actions";
import {
  Alert,
  Badge,
  Field,
  PageHeader,
  Panel,
  PanelEmpty,
  PrimaryButton,
  StatCard,
  inputClass,
  labelClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { SlideOver } from "@/components/SlideOver";
import { RowMenu, RowMenuDelete, RowMenuLink, RowMenuOpenPanel, RowMenuSeparator } from "@/components/RowMenu";
import { aed, computeSalary, currentMonth, monthBounds, monthLabel, shiftMonth } from "@/lib/salary";
import { dayKey, formatDate } from "@/lib/format";

export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ month?: string; advance?: string }> }) {
  const { month: monthParam, advance } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();
  const { start, end } = monthBounds(month);
  const isCurrent = month === currentMonth();

  const supabase = await createClient();
  const [{ data: profiles }, { data: attendance }, { data: holidays }, { data: advances, error: advancesError }, { data: payments }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("full_name").returns<Profile[]>(),
      supabase.from("attendance").select("*").gte("attendance_date", start).lte("attendance_date", end).returns<Attendance[]>(),
      supabase.from("shop_holidays").select("*").gte("holiday_date", start).lte("holiday_date", end).returns<ShopHoliday[]>(),
      supabase
        .from("staff_advances")
        .select("*")
        .gte("advance_date", start)
        .lte("advance_date", end)
        .order("advance_date", { ascending: false })
        .returns<StaffAdvance[]>(),
      supabase.from("salary_payments").select("*").eq("month", month).returns<SalaryPayment[]>(),
    ]);

  const staff = profiles ?? [];
  const nameById = new Map(staff.map((p) => [p.id, p.full_name]));
  const holidayDates = (holidays ?? []).map((h) => h.holiday_date);
  const paidBy = new Map((payments ?? []).map((p) => [p.profile_id, p]));

  const rows = staff.map((p) => {
    const line = computeSalary({
      baseSalary: Number(p.monthly_salary ?? 0),
      month,
      holidayDates,
      statuses: (attendance ?? []).filter((a) => a.profile_id === p.id).map((a) => a.status),
      advances: (advances ?? []).filter((a) => a.profile_id === p.id).reduce((s, a) => s + Number(a.amount), 0),
    });
    return { profile: p, line, payment: paidBy.get(p.id) ?? null };
  });

  const totalBase = rows.reduce((s, r) => s + r.line.baseSalary, 0);
  const totalAdvances = rows.reduce((s, r) => s + r.line.advances, 0);
  const totalPaid = rows.reduce((s, r) => s + (r.payment ? Number(r.payment.net_pay) : 0), 0);
  const stillToPay = rows.reduce((s, r) => s + (r.payment ? 0 : Math.max(0, r.line.net)), 0);
  const missingTables = advancesError?.code === "42P01" || advancesError?.message?.includes("staff_advances");

  return (
    <div className="page">
      <Link href="/staff" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to staff
      </Link>
      <PageHeader
        title="Salaries & advances"
        description={`${monthLabel(month)} · salary minus absent days and cash advances`}
        action={
          <>
            <div className="inline-flex items-center rounded-md border border-zinc-300 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
              <Link href={`/staff/salaries?month=${shiftMonth(month, -1)}`} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center text-zinc-500 hover:text-zinc-900">
                <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
              </Link>
              <span className="min-w-[7.5rem] border-x border-zinc-200 px-2 text-center text-[13px] font-medium text-zinc-800">{monthLabel(month)}</span>
              <Link href={`/staff/salaries?month=${shiftMonth(month, 1)}`} aria-label="Next month" className="flex h-9 w-9 items-center justify-center text-zinc-500 hover:text-zinc-900">
                <Icon name="chevron-right" className="h-4 w-4" />
              </Link>
            </div>
            <SlideOver
              id="give-advance"
              defaultOpen={advance === "1"}
              title="Give cash advance"
              description="Recorded as a Salaries expense today and deducted from this month's salary."
              triggerLabel="Give advance"
              triggerIcon="wallet"
            >
              <form action={addStaffAdvance} className="space-y-4">
                <label className="block">
                  <span className={labelClass}>
                    Staff member <span className="text-brand-600">*</span>
                  </span>
                  <select name="profile_id" required className={inputClass}>
                    <option value="">Select…</option>
                    {staff.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Amount (AED)" name="amount" type="number" step="0.01" required />
                <Field label="Date" name="advance_date" type="date" defaultValue={isCurrent ? dayKey(new Date()) : start} required />
                <Field label="Note" name="note" placeholder="e.g. Family emergency" />
                <PrimaryButton type="submit" className="w-full">
                  Save advance
                </PrimaryButton>
              </form>
            </SlideOver>
          </>
        }
      />

      {missingTables && (
        <Alert tone="warning" className="mb-6" title="One-time database update needed">
          Run <code className="font-mono">schema_phase30_salaries_suppliers_counter.sql</code> in the Supabase SQL editor to switch on salaries and advances.
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Monthly salaries" value={aed(totalBase)} hint={`${staff.length} staff`} />
        <StatCard label="Advances this month" value={aed(totalAdvances)} hint={`${advances?.length ?? 0} advances`} accent={totalAdvances > 0 ? "amber" : "slate"} />
        <StatCard label="Paid" value={aed(totalPaid)} hint={`${payments?.length ?? 0} of ${staff.length} paid`} accent="green" />
        <StatCard label="Still to pay" value={aed(stillToPay)} hint="After deductions" accent={stillToPay > 0 ? "red" : "slate"} />
      </div>

      <Panel title="Salary sheet" count={rows.length} className="mb-6">
        {rows.length === 0 ? (
          <PanelEmpty message="No staff yet. Add staff first, with their monthly salary." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Staff</th>
                  <th className={`${thClass} hidden text-right md:table-cell`}>Salary</th>
                  <th className={`${thClass} hidden text-right md:table-cell`}>Absent</th>
                  <th className={`${thClass} hidden text-right lg:table-cell`}>Deduction</th>
                  <th className={`${thClass} hidden text-right sm:table-cell`}>Advances</th>
                  <th className={`${thClass} text-right`}>Net pay</th>
                  <th className={`${thClass} hidden sm:table-cell`}>Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ profile: p, line, payment }) => {
                  const net = payment ? Number(payment.net_pay) : line.net;
                  const noSalary = !p.monthly_salary;
                  return (
                    <tr key={p.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                      <td className={tdClass}>
                        <p className="font-medium text-zinc-900">{p.full_name}</p>
                        <p className="text-xs capitalize text-zinc-500">
                          {p.role}
                          <span className="md:hidden">
                            {" "}
                            · {line.absentDays} absent{line.advances > 0 ? ` · ${aed(line.advances)} adv.` : ""}
                          </span>
                        </p>
                      </td>
                      <td className={`${tdClass} hidden text-right tabular md:table-cell`}>
                        {noSalary ? (
                          <Link href="/staff" className="text-xs font-medium text-amber-700 hover:underline">
                            Set salary
                          </Link>
                        ) : (
                          aed(line.baseSalary)
                        )}
                      </td>
                      <td className={`${tdClass} hidden text-right tabular md:table-cell`}>
                        {line.absentDays} <span className="text-zinc-400">/ {line.workingDays}</span>
                      </td>
                      <td className={`${tdClass} hidden text-right tabular text-zinc-600 lg:table-cell`}>
                        {line.absenceDeduction > 0 ? `− ${aed(line.absenceDeduction)}` : "—"}
                      </td>
                      <td className={`${tdClass} hidden text-right tabular text-zinc-600 sm:table-cell`}>
                        {line.advances > 0 ? `− ${aed(line.advances)}` : "—"}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right font-semibold tabular ${net < 0 ? "text-red-700" : "text-zinc-900"}`}>
                        {aed(net)}
                        <div className="mt-1 sm:hidden">
                          {payment ? <Badge color="green" dot>Paid</Badge> : <Badge color="amber" dot>Due</Badge>}
                        </div>
                      </td>
                      <td className={`${tdClass} hidden sm:table-cell`}>
                        {payment ? (
                          <Badge color="green" dot>
                            Paid {formatDate(payment.paid_at)}
                          </Badge>
                        ) : (
                          <Badge color="amber" dot>
                            Due
                          </Badge>
                        )}
                      </td>
                      <td className="pr-3 text-right">
                        <RowMenu>
                          {!payment && <RowMenuOpenPanel panelId={`pay-${p.id}`} icon="check">Pay salary</RowMenuOpenPanel>}
                          <RowMenuLink href={`/staff/salaries/payslip?profile=${p.id}&month=${month}`} icon="printer">
                            Payslip
                          </RowMenuLink>
                          <RowMenuOpenPanel panelId="give-advance" icon="wallet">Give advance</RowMenuOpenPanel>
                          {payment && (
                            <>
                              <RowMenuSeparator />
                              <RowMenuDelete
                                action={undoSalaryPayment.bind(null, payment.id)}
                                confirmMessage={`Undo ${p.full_name}'s salary payment for ${monthLabel(month)}? The matching expense is removed too.`}
                                successMessage="Salary payment undone."
                                label="Undo payment"
                              />
                            </>
                          )}
                        </RowMenu>
                        {!payment && (
                          <SlideOver
                            id={`pay-${p.id}`}
                            hideTrigger
                            title={`Pay ${p.full_name}`}
                            description={`${monthLabel(month)} salary. Saved as a Salaries expense today.`}
                            triggerLabel="Pay"
                          >
                            <form action={paySalary.bind(null, p.id, month)} className="space-y-4 text-left">
                              <dl className="divide-y divide-zinc-100 rounded-md border border-zinc-200 text-[13px]">
                                <div className="flex justify-between px-3 py-2">
                                  <dt className="text-zinc-500">Monthly salary</dt>
                                  <dd className="tabular text-zinc-900">{aed(line.baseSalary)}</dd>
                                </div>
                                <div className="flex justify-between px-3 py-2">
                                  <dt className="text-zinc-500">
                                    Absent {line.absentDays} of {line.workingDays} days × {aed(line.dailyRate)}
                                  </dt>
                                  <dd className="tabular text-zinc-900">− {aed(line.absenceDeduction)}</dd>
                                </div>
                                <div className="flex justify-between px-3 py-2">
                                  <dt className="text-zinc-500">Cash advances</dt>
                                  <dd className="tabular text-zinc-900">− {aed(line.advances)}</dd>
                                </div>
                                <div className="flex justify-between bg-zinc-50 px-3 py-2 font-semibold">
                                  <dt className="text-zinc-900">Net before bonus</dt>
                                  <dd className="tabular text-zinc-900">{aed(line.net)}</dd>
                                </div>
                              </dl>
                              <div className="grid grid-cols-2 gap-4">
                                <Field label="Bonus / overtime (AED)" name="bonus" type="number" step="0.01" placeholder="0" />
                                <Field label="Other deduction (AED)" name="other_deduction" type="number" step="0.01" placeholder="0" />
                              </div>
                              <label className="block">
                                <span className={labelClass}>Paid by</span>
                                <select name="method" defaultValue="cash" className={inputClass}>
                                  <option value="cash">Cash</option>
                                  <option value="bank_transfer">Bank transfer / WPS</option>
                                  <option value="other">Other</option>
                                </select>
                              </label>
                              <Field label="Note" name="note" placeholder="Optional" />
                              <PrimaryButton type="submit" icon="check" className="w-full">
                                Mark as paid
                              </PrimaryButton>
                            </form>
                          </SlideOver>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Advances · ${monthLabel(month)}`} count={advances?.length ?? 0}>
        {(advances?.length ?? 0) === 0 ? (
          <PanelEmpty message="No cash advances this month." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {advances!.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                  <Icon name="wallet" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{nameById.get(a.profile_id) ?? "Staff"}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {formatDate(a.advance_date)}
                    {a.note ? ` · ${a.note}` : ""}
                    {paidBy.has(a.profile_id) ? " · salary already paid" : ""}
                  </p>
                </div>
                <span className="text-sm font-medium tabular text-zinc-900">{aed(Number(a.amount))}</span>
                <RowMenu>
                  <RowMenuDelete
                    action={deleteStaffAdvance.bind(null, a.id)}
                    confirmMessage="Remove this advance? Its expense entry is removed too."
                    successMessage="Advance removed."
                    label="Remove"
                  />
                </RowMenu>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
