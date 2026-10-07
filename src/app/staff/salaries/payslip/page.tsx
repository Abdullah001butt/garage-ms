import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Attendance, Profile, SalaryPayment, ShopHoliday, ShopSettings, StaffAdvance } from "@/lib/types";
import { Card, PageHeader, SecondaryButton } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { aed, computeSalary, currentMonth, monthBounds, monthLabel } from "@/lib/salary";
import { formatDate } from "@/lib/format";

const METHOD_LABEL: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer / WPS", other: "Other" };

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 px-4 py-2 text-[13px] ${strong ? "bg-zinc-50 font-semibold text-zinc-900" : "text-zinc-700"}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}

export default async function PayslipPage({ searchParams }: { searchParams: Promise<{ profile?: string; month?: string }> }) {
  const { profile: profileId, month: monthParam } = await searchParams;
  if (!profileId) notFound();
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();
  const { start, end } = monthBounds(month);

  const supabase = await createClient();
  const [{ data: profile }, { data: settings }, { data: attendance }, { data: holidays }, { data: advances }, { data: payment }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).maybeSingle<Profile>(),
    supabase.from("shop_settings").select("*").limit(1).maybeSingle<ShopSettings>(),
    supabase.from("attendance").select("*").eq("profile_id", profileId).gte("attendance_date", start).lte("attendance_date", end).returns<Attendance[]>(),
    supabase.from("shop_holidays").select("*").gte("holiday_date", start).lte("holiday_date", end).returns<ShopHoliday[]>(),
    supabase
      .from("staff_advances")
      .select("*")
      .eq("profile_id", profileId)
      .gte("advance_date", start)
      .lte("advance_date", end)
      .order("advance_date")
      .returns<StaffAdvance[]>(),
    supabase.from("salary_payments").select("*").eq("profile_id", profileId).eq("month", month).maybeSingle<SalaryPayment>(),
  ]);
  if (!profile) notFound();

  const live = computeSalary({
    baseSalary: Number(profile.monthly_salary ?? 0),
    month,
    holidayDates: (holidays ?? []).map((h) => h.holiday_date),
    attendance: attendance ?? [],
    advances: (advances ?? []).reduce((s, a) => s + Number(a.amount), 0),
  });
  // Once paid, the payslip shows exactly what was paid (a snapshot), not today's recalculation.
  const base = payment ? Number(payment.base_salary) : live.baseSalary;
  const absentDays = payment ? payment.absent_days : live.absentDays;
  const workingDays = payment ? payment.working_days : live.workingDays;
  const absenceDeduction = payment ? Number(payment.absence_deduction) : live.absenceDeduction;
  const advanceTotal = payment ? Number(payment.advances) : live.advances;
  const bonus = payment ? Number(payment.bonus) : 0;
  const otherDeduction = payment ? Number(payment.other_deduction) : 0;
  const net = payment ? Number(payment.net_pay) : live.net;
  const presentDays = (attendance ?? []).filter((a) => a.status === "present").length;
  const leaveDays = (attendance ?? []).filter((a) => a.status === "paid_leave").length;

  return (
    <div className="page page-narrow">
      <Link href={`/staff/salaries?month=${month}`} className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900 print:hidden">
        ← Back to salaries
      </Link>
      <PageHeader
        title="Payslip"
        description={`${profile.full_name} · ${monthLabel(month)}`}
        action={
          <>
            <Link href={`/staff/salaries?month=${month}`}>
              <SecondaryButton type="button">Done</SecondaryButton>
            </Link>
            <PrintButton label="Print payslip" />
          </>
        }
      />

      <Card className="p-6 sm:p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-4">
          <div>
            <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={140} height={40} className="h-10 w-auto object-contain" />
            <p className="mt-2 text-sm font-bold text-zinc-900">{settings?.shop_name ?? "AL BAHIR VEHICLES REPAIR LLC"}</p>
            {settings?.address && <p className="text-xs text-zinc-500">{settings.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tracking-tight text-zinc-900">PAYSLIP</p>
            <p className="text-[13px] text-zinc-600">{monthLabel(month)}</p>
            <p className={`mt-1 text-xs font-medium ${payment ? "text-emerald-700" : "text-amber-700"}`}>
              {payment ? `Paid ${formatDate(payment.paid_at)} · ${METHOD_LABEL[payment.method] ?? payment.method}` : "Not paid yet — preview"}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 py-4 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-xs text-zinc-500">Employee</dt>
            <dd className="font-medium text-zinc-900">{profile.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Role</dt>
            <dd className="font-medium capitalize text-zinc-900">{profile.role}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Working days</dt>
            <dd className="font-medium tabular text-zinc-900">{workingDays}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Present · Leave · Absent</dt>
            <dd className="font-medium tabular text-zinc-900">
              {presentDays} · {leaveDays} · {absentDays}
            </dd>
          </div>
        </dl>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-md border border-zinc-200">
            <p className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">Earnings</p>
            <Row label="Basic monthly salary" value={aed(base)} />
            {bonus > 0 && <Row label="Bonus / overtime" value={aed(bonus)} />}
            <Row label="Total earnings" value={aed(base + bonus)} strong />
          </div>
          <div className="overflow-hidden rounded-md border border-zinc-200">
            <p className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">Deductions</p>
            <Row label={`Absent days (${absentDays})`} value={aed(absenceDeduction)} />
            <Row label="Cash advances" value={aed(advanceTotal)} />
            {otherDeduction > 0 && <Row label="Other" value={aed(otherDeduction)} />}
            <Row label="Total deductions" value={aed(absenceDeduction + advanceTotal + otherDeduction)} strong />
          </div>
        </div>

        {(advances?.length ?? 0) > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-zinc-500">Advances taken this month</p>
            <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 text-[13px]">
              {advances!.map((a) => (
                <li key={a.id} className="flex justify-between gap-4 px-4 py-1.5">
                  <span className="text-zinc-600">
                    {formatDate(a.advance_date)}
                    {a.note ? ` · ${a.note}` : ""}
                  </span>
                  <span className="tabular text-zinc-900">{aed(Number(a.amount))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between rounded-md bg-zinc-900 px-4 py-3 text-white">
          <span className="text-sm font-medium">Net pay</span>
          <span className="text-xl font-semibold tabular">{aed(net)}</span>
        </div>
        {payment?.note && <p className="mt-2 text-xs text-zinc-500">Note: {payment.note}</p>}

        <div className="mt-12 grid grid-cols-2 gap-10 text-xs text-zinc-500">
          <div className="border-t border-zinc-400 pt-1.5">Employee signature</div>
          <div className="border-t border-zinc-400 pt-1.5">Authorised by</div>
        </div>
      </Card>
    </div>
  );
}
