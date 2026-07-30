"use client";

import { useState, useTransition } from "react";
import type { AttendanceStatus } from "@/lib/types";
import { ATTENDANCE_CYCLE } from "@/lib/attendance-cycle";
import { useToast } from "@/components/Toast";

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

type ProfileRow = { id: string; full_name: string; monthly_salary: number | null };

export function AttendanceGrid({
  profiles,
  initialAttendance,
  monthValue,
  daysInMonth,
  cycleAttendance,
}: {
  profiles: ProfileRow[];
  initialAttendance: Record<string, AttendanceStatus>;
  monthValue: string;
  daysInMonth: number;
  cycleAttendance: (profileId: string, date: string, currentStatus: AttendanceStatus | "none") => Promise<void>;
}) {
  const [attendance, setAttendance] = useState(initialAttendance);
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function handleClick(profileId: string, dateStr: string) {
    const key = `${profileId}_${dateStr}`;
    const currentStatus = (attendance[key] ?? "none") as AttendanceStatus | "none";
    const nextStatus = ATTENDANCE_CYCLE[currentStatus];

    setAttendance((prev) => ({ ...prev, [key]: nextStatus }));

    startTransition(async () => {
      try {
        await cycleAttendance(profileId, dateStr, currentStatus);
      } catch (err) {
        setAttendance((prev) => {
          const next = { ...prev };
          if (currentStatus === "none") {
            delete next[key];
          } else {
            next[key] = currentStatus;
          }
          return next;
        });
        showToast(err instanceof Error ? err.message : "Failed to update attendance.", "error");
      }
    });
  }

  return (
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
        {profiles.map((p) => {
          let presentCount = 0;
          let paidLeaveCount = 0;
          for (const d of days) {
            const dateStr = `${monthValue}-${String(d).padStart(2, "0")}`;
            const status = attendance[`${p.id}_${dateStr}`];
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
                const status = attendance[`${p.id}_${dateStr}`] ?? "none";
                return (
                  <td key={d} className="border-b border-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleClick(p.id, dateStr)}
                      className={`w-7 h-7 rounded text-xs font-semibold ${STATUS_STYLE[status]}`}
                    >
                      {STATUS_ABBR[status]}
                    </button>
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
  );
}
