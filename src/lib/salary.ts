import { dayKey } from "@/lib/format";
import type { AttendanceStatus } from "@/lib/types";

/** "2026-10" for the current month in UAE time. */
export function currentMonth() {
  return dayKey(new Date()).slice(0, 7);
}

export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(days).padStart(2, "0")}`, days };
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type SalaryLine = {
  baseSalary: number;
  workingDays: number;
  absentDays: number;
  dailyRate: number;
  absenceDeduction: number;
  advances: number;
  net: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The garage is closed on Fridays, so they are never working days. */
export function isFriday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5;
}

/**
 * Fixed monthly salary, minus a day's pay for each absent day, minus cash advances.
 * Working days = days in the month minus Fridays (closed) and the shop's other holidays.
 * Paid leave, Fridays and holidays are never deducted, even if marked absent by mistake.
 */
export function computeSalary({
  baseSalary,
  month,
  holidayDates,
  attendance,
  advances,
}: {
  baseSalary: number;
  month: string;
  holidayDates: string[];
  attendance: { attendance_date: string; status: AttendanceStatus }[];
  advances: number;
}): SalaryLine {
  const { days } = monthBounds(month);
  const offDays = new Set(holidayDates.filter((d) => d.startsWith(month)));
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    if (isFriday(date)) offDays.add(date);
  }
  const workingDays = Math.max(0, days - offDays.size);
  const absentDays = attendance.filter((a) => a.status === "absent" && !offDays.has(a.attendance_date)).length;
  const dailyRate = workingDays > 0 ? baseSalary / workingDays : 0;
  const absenceDeduction = round2(Math.min(baseSalary, dailyRate * absentDays));
  return {
    baseSalary,
    workingDays,
    absentDays,
    dailyRate: round2(dailyRate),
    absenceDeduction,
    advances: round2(advances),
    net: round2(baseSalary - absenceDeduction - advances),
  };
}

export const aed = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
