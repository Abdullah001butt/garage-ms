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

/**
 * Fixed monthly salary, minus a day's pay for each absent day, minus cash advances.
 * Working days = days in the month minus the shop's holidays (Fridays, public holidays).
 * Paid leave and holidays are never deducted.
 */
export function computeSalary({
  baseSalary,
  month,
  holidayDates,
  statuses,
  advances,
}: {
  baseSalary: number;
  month: string;
  holidayDates: string[];
  statuses: AttendanceStatus[];
  advances: number;
}): SalaryLine {
  const { days } = monthBounds(month);
  const holidays = new Set(holidayDates.filter((d) => d.startsWith(month))).size;
  const workingDays = Math.max(0, days - holidays);
  const absentDays = statuses.filter((s) => s === "absent").length;
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
