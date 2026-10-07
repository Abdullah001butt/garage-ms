"use client";

import { useState, useTransition } from "react";
import type { AttendanceStatus } from "@/lib/types";
import { ATTENDANCE_CYCLE } from "@/lib/attendance-cycle";
import { useToast } from "@/components/Toast";

const STATUS_STYLE: Record<string, string> = {
  none: "bg-zinc-50 text-zinc-300",
  present: "bg-emerald-100 text-emerald-700",
  absent: "bg-red-100 text-red-700",
  paid_leave: "bg-blue-100 text-blue-700",
  holiday: "bg-zinc-200 text-zinc-500",
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
  closedDates = [],
}: {
  profiles: ProfileRow[];
  /** Fridays and shop holidays — shaded, never counted as absent. */
  closedDates?: string[];
  initialAttendance: Record<string, AttendanceStatus>;
  monthValue: string;
  daysInMonth: number;
  cycleAttendance: (profileId: string, date: string, currentStatus: AttendanceStatus | "none") => Promise<void>;
}) {
  const [attendance, setAttendance] = useState(initialAttendance);
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const closed = new Set(closedDates);
  const dateOf = (d: number) => `${monthValue}-${String(d).padStart(2, "0")}`;
  const weekday = (d: number) => {
    const [y, m] = monthValue.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" });
  };

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
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-zinc-50/80">
          <th className="sticky left-0 z-10 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-left text-xs font-medium text-zinc-500">Staff</th>
          {days.map((d) => (
            <th
              key={d}
              className={`min-w-[1.6rem] border-b border-zinc-200 px-0.5 py-1.5 text-center text-[11px] font-medium leading-tight ${closed.has(dateOf(d)) ? "bg-zinc-100 text-zinc-400" : "text-zinc-500"}`}
              title={closed.has(dateOf(d)) ? "Closed" : undefined}
            >
              <span className="block text-[10px] font-normal text-zinc-400">{weekday(d)}</span>
              {d}
            </th>
          ))}
          <th className="border-b border-zinc-200 px-3 py-2 text-right text-xs font-medium text-zinc-500">Present</th>
          <th className="border-b border-zinc-200 px-4 py-2 text-right text-xs font-medium text-zinc-500">Absent</th>
        </tr>
      </thead>
      <tbody>
        {profiles.map((p) => {
          let presentCount = 0;
          let paidLeaveCount = 0;
          let absentCount = 0;
          for (const d of days) {
            const status = attendance[`${p.id}_${dateOf(d)}`];
            if (status === "present") presentCount++;
            if (status === "paid_leave") paidLeaveCount++;
            if (status === "absent" && !closed.has(dateOf(d))) absentCount++;
          }

          return (
            <tr key={p.id}>
              <td className="sticky left-0 z-10 whitespace-nowrap border-b border-zinc-100 bg-white px-4 py-1.5 font-medium text-zinc-900">
                {p.full_name}
              </td>
              {days.map((d) => {
                const dateStr = `${monthValue}-${String(d).padStart(2, "0")}`;
                const status = (attendance[`${p.id}_${dateStr}`] ?? "none") as AttendanceStatus | "none";
                return (
                  <td key={d} className={`border-b border-zinc-100 p-0.5 ${closed.has(dateStr) ? "bg-zinc-50" : ""}`}>
                    <button
                      type="button"
                      onClick={() => handleClick(p.id, dateStr)}
                      aria-label={`${p.full_name}, ${dateStr}: ${status}`}
                      className={`h-7 w-full min-w-6 rounded text-xs font-semibold ${status === "none" && closed.has(dateStr) ? "bg-transparent text-zinc-300" : STATUS_STYLE[status]}`}
                    >
                      {STATUS_ABBR[status]}
                    </button>
                  </td>
                );
              })}
              <td className="border-b border-zinc-100 px-3 py-1.5 text-right tabular text-zinc-700">{presentCount + paidLeaveCount}</td>
              <td className={`border-b border-zinc-100 px-4 py-1.5 text-right font-medium tabular ${absentCount ? "text-red-700" : "text-zinc-400"}`}>{absentCount}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
