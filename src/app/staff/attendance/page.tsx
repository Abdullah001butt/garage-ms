import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Attendance, AttendanceStatus, Profile, ShopHoliday } from "@/lib/types";
import { cycleAttendance } from "@/app/staff/attendance/actions";
import { PageHeader, Panel, SecondaryButton } from "@/components/ui";
import { MonthSwitcher } from "@/components/report-ui";
import { AttendanceGrid } from "@/components/AttendanceGrid";
import { currentMonth, isFriday, monthBounds, monthLabel, shiftMonth } from "@/lib/salary";

const LEGEND = [
  { label: "Present", cls: "bg-emerald-100 text-emerald-700", abbr: "P" },
  { label: "Absent", cls: "bg-red-100 text-red-700", abbr: "A" },
  { label: "Paid leave", cls: "bg-blue-100 text-blue-700", abbr: "L" },
  { label: "Holiday", cls: "bg-zinc-200 text-zinc-500", abbr: "H" },
];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();
  const { start, end, days } = monthBounds(month);

  const supabase = await createClient();
  const [{ data: profiles }, { data: attendance }, { data: holidays }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at").returns<Profile[]>(),
    supabase.from("attendance").select("*").gte("attendance_date", start).lte("attendance_date", end).returns<Attendance[]>(),
    supabase.from("shop_holidays").select("*").gte("holiday_date", start).lte("holiday_date", end).returns<ShopHoliday[]>(),
  ]);

  const attendanceMap: Record<string, AttendanceStatus> = {};
  for (const a of attendance ?? []) attendanceMap[`${a.profile_id}_${a.attendance_date}`] = a.status;

  const closedDates = [...new Set([
    ...(holidays ?? []).map((h) => h.holiday_date),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter(isFriday),
  ])];

  return (
    <div className="page">
      <Link href="/staff" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to staff
      </Link>
      <PageHeader
        title="Attendance"
        description={`${monthLabel(month)} · ${days - closedDates.length} working days · tap a day to cycle Present → Absent → Leave → Holiday`}
        action={
          <>
            <MonthSwitcher
              label={monthLabel(month)}
              prevHref={`/staff/attendance?month=${shiftMonth(month, -1)}`}
              nextHref={`/staff/attendance?month=${shiftMonth(month, 1)}`}
              thisHref="/staff/attendance"
              isCurrent={month === currentMonth()}
            />
            <a href={`/staff/attendance/export?month=${month}`}>
              <SecondaryButton type="button" icon="download">
                Export
              </SecondaryButton>
            </a>
            <Link href={`/staff/salaries?month=${month}`}>
              <SecondaryButton type="button" icon="wallet">
                Salaries
              </SecondaryButton>
            </Link>
          </>
        }
      />

      <Panel
        title="Attendance sheet"
        count={profiles?.length ?? 0}
        action={
          <span className="hidden items-center gap-3 text-xs text-zinc-500 md:flex">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${l.cls}`}>{l.abbr}</span>
                {l.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-4 w-4 rounded bg-zinc-100" />
              Friday / closed
            </span>
          </span>
        }
      >
        <div className="relative overflow-x-auto">
          <AttendanceGrid
            profiles={profiles ?? []}
            initialAttendance={attendanceMap}
            monthValue={month}
            daysInMonth={days}
            cycleAttendance={cycleAttendance}
            closedDates={closedDates}
          />
        </div>
      </Panel>
    </div>
  );
}
