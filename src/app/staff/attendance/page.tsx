import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Attendance, AttendanceStatus, Profile } from "@/lib/types";
import { cycleAttendance } from "@/app/staff/attendance/actions";
import { Card, PageHeader, SecondaryButton } from "@/components/ui";
import { AttendanceGrid } from "@/components/AttendanceGrid";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthValue = month || currentMonthValue();
  const [year, mon] = monthValue.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const monthStart = `${monthValue}-01`;
  const monthEnd = `${monthValue}-${String(daysInMonth).padStart(2, "0")}`;

  const supabase = await createClient();

  const [{ data: profiles }, { data: attendance }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at").returns<Profile[]>(),
    supabase
      .from("attendance")
      .select("*")
      .gte("attendance_date", monthStart)
      .lte("attendance_date", monthEnd)
      .returns<Attendance[]>(),
  ]);

  const attendanceMap: Record<string, AttendanceStatus> = {};
  for (const a of attendance ?? []) {
    attendanceMap[`${a.profile_id}_${a.attendance_date}`] = a.status;
  }

  return (
    <div className="page">
      <Link href="/staff" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to staff
      </Link>
      <PageHeader
        title="Attendance & Salary"
        description="Click a day to cycle: Present → Absent → Paid Leave → Holiday."
        action={
          <a href={`/staff/attendance/export?month=${monthValue}`}>
            <SecondaryButton type="button">Export Excel</SecondaryButton>
          </a>
        }
      />

      <Card className="p-4 mb-6">
        <form className="flex flex-wrap items-end gap-3 sm:gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-700 mb-1">Month</span>
            <input
              type="month"
              name="month"
              defaultValue={monthValue}
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
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-100">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-100" />Present</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-100" />Absent</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-100" />Paid Leave</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-zinc-200" />Holiday</span>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <AttendanceGrid
          profiles={profiles ?? []}
          initialAttendance={attendanceMap}
          monthValue={monthValue}
          daysInMonth={daysInMonth}
          cycleAttendance={cycleAttendance}
        />
      </Card>
    </div>
  );
}
