import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Attendance, AttendanceStatus, Profile } from "@/lib/types";
import { cycleAttendance } from "@/app/staff/attendance/actions";
import { Card, PageHeader } from "@/components/ui";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_STYLE: Record<string, string> = {
  none: "bg-slate-50 text-slate-300",
  present: "bg-emerald-100 text-emerald-700",
  absent: "bg-red-100 text-red-700",
  paid_leave: "bg-blue-100 text-blue-700",
  holiday: "bg-slate-200 text-slate-500",
};

const STATUS_ABBR: Record<string, string> = {
  none: "-",
  present: "P",
  absent: "A",
  paid_leave: "L",
  holiday: "H",
};

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

  const attendanceMap = new Map<string, AttendanceStatus>();
  for (const a of attendance ?? []) {
    attendanceMap.set(`${a.profile_id}_${a.attendance_date}`, a.status);
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <Link href="/staff" className="text-sm text-indigo-600 hover:underline">
        &larr; Back to staff
      </Link>
      <PageHeader
        title="Attendance & Salary"
        description="Click a day to cycle: Present → Absent → Paid Leave → Holiday."
      />

      <Card className="p-4 mb-6">
        <form className="flex flex-wrap items-end gap-3 sm:gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-700 mb-1">Month</span>
            <input
              type="month"
              name="month"
              defaultValue={monthValue}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            View
          </button>
        </form>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-100" />Present</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-100" />Absent</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-100" />Paid Leave</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-slate-200" />Holiday</span>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium text-slate-500 border-b border-slate-200">
                Staff
              </th>
              {days.map((d) => (
                <th key={d} className="px-1 py-2 text-center font-medium text-slate-400 border-b border-slate-200 w-8">
                  {d}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-slate-500 border-b border-slate-200">Present</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500 border-b border-slate-200">Salary (AED)</th>
            </tr>
          </thead>
          <tbody>
            {profiles?.map((p) => {
              let presentCount = 0;
              let paidLeaveCount = 0;
              for (const d of days) {
                const dateStr = `${monthValue}-${String(d).padStart(2, "0")}`;
                const status = attendanceMap.get(`${p.id}_${dateStr}`);
                if (status === "present") presentCount++;
                if (status === "paid_leave") paidLeaveCount++;
              }
              const dailyRate = p.monthly_salary ? p.monthly_salary / daysInMonth : 0;
              const salary = dailyRate * (presentCount + paidLeaveCount);

              return (
                <tr key={p.id}>
                  <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-slate-900 border-b border-slate-100 whitespace-nowrap">
                    {p.full_name}
                  </td>
                  {days.map((d) => {
                    const dateStr = `${monthValue}-${String(d).padStart(2, "0")}`;
                    const status = attendanceMap.get(`${p.id}_${dateStr}`) ?? "none";
                    return (
                      <td key={d} className="border-b border-slate-100 p-0.5">
                        <form action={cycleAttendance.bind(null, p.id, dateStr, status)}>
                          <button
                            type="submit"
                            className={`w-7 h-7 rounded text-xs font-semibold ${STATUS_STYLE[status]}`}
                          >
                            {STATUS_ABBR[status]}
                          </button>
                        </form>
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right border-b border-slate-100">{presentCount + paidLeaveCount}</td>
                  <td className="px-3 py-1.5 text-right font-medium border-b border-slate-100">
                    {p.monthly_salary ? salary.toFixed(2) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
