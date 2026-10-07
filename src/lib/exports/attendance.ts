import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyBodyRow, startSheet, CURRENCY_FORMAT, XLSX_COLORS, type SheetColumn } from "@/lib/xlsx-style";
import { computeSalary, isFriday, monthBounds, monthLabel } from "@/lib/salary";
import type { Attendance, AttendanceStatus, Profile, ShopHoliday, StaffAdvance } from "@/lib/types";

const STATUS_FILL: Record<string, string> = {
  present: "FFD1FAE5",
  absent: "FFFEE2E2",
  paid_leave: "FFDBEAFE",
  holiday: "FFE4E4E7",
};

const STATUS_ABBR: Record<string, string> = { present: "P", absent: "A", paid_leave: "L", holiday: "H" };

export async function buildAttendanceWorkbook(month: string) {
  const { start, end, days: daysInMonth } = monthBounds(month);
  const supabase = await createClient();

  const [{ data: profiles }, { data: attendance }, { data: holidays }, { data: advances }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at").returns<Profile[]>(),
    supabase.from("attendance").select("*").gte("attendance_date", start).lte("attendance_date", end).returns<Attendance[]>(),
    supabase.from("shop_holidays").select("*").gte("holiday_date", start).lte("holiday_date", end).returns<ShopHoliday[]>(),
    supabase.from("staff_advances").select("*").gte("advance_date", start).lte("advance_date", end).returns<StaffAdvance[]>(),
  ]);

  const attendanceMap = new Map<string, AttendanceStatus>();
  for (const a of attendance ?? []) attendanceMap.set(`${a.profile_id}_${a.attendance_date}`, a.status);
  const holidayDates = (holidays ?? []).map((h) => h.holiday_date);
  const closed = new Set(holidayDates);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dateOf = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const columns: SheetColumn[] = [
    { header: "Staff", key: "staff", width: 24 },
    ...days.map((d) => ({ header: String(d), key: `d${d}`, width: 4.2, align: "center" as const })),
    { header: "Present", key: "present", width: 9, align: "center" },
    { header: "Absent", key: "absent", width: 9, align: "center" },
    { header: "Salary", key: "salary", width: 14, numFmt: CURRENCY_FORMAT },
    { header: "Deduction", key: "deduction", width: 13, numFmt: CURRENCY_FORMAT },
    { header: "Advances", key: "advances", width: 13, numFmt: CURRENCY_FORMAT },
    { header: "Net pay", key: "net", width: 14, numFmt: CURRENCY_FORMAT },
  ];
  const workbook = new ExcelJS.Workbook();
  const { sheet } = startSheet(workbook, `Attendance ${month}`, {
    title: `Attendance & Salary — ${monthLabel(month)}`,
    subtitle: "P = present · A = absent · L = paid leave · H = holiday · grey = Friday / closed",
    columns,
    freezeColumns: 1,
    landscape: true,
  });

  // Closed days (Fridays and holidays) get a grey header cell.
  days.forEach((d, i) => {
    if (isFriday(dateOf(d)) || closed.has(dateOf(d))) {
      sheet.getRow(5).getCell(i + 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF52525B" } };
    }
  });

  (profiles ?? []).forEach((p, index) => {
    const mine = (attendance ?? []).filter((a) => a.profile_id === p.id);
    const line = computeSalary({
      baseSalary: Number(p.monthly_salary ?? 0),
      month,
      holidayDates,
      attendance: mine,
      advances: (advances ?? []).filter((a) => a.profile_id === p.id).reduce((s, a) => s + Number(a.amount), 0),
    });
    const rowData: Record<string, string | number> = {
      staff: p.full_name,
      present: mine.filter((a) => a.status === "present" || a.status === "paid_leave").length,
      absent: line.absentDays,
      salary: line.baseSalary,
      deduction: line.absenceDeduction,
      advances: line.advances,
      net: line.net,
    };
    for (const d of days) {
      const status = attendanceMap.get(`${p.id}_${dateOf(d)}`);
      rowData[`d${d}`] = status ? STATUS_ABBR[status] : "";
    }
    const row = sheet.addRow(rowData);
    applyBodyRow(row, index, columns);
    row.getCell("staff").font = { name: "Calibri", size: 10, bold: true, color: { argb: XLSX_COLORS.ink } };
    row.getCell("net").font = { name: "Calibri", size: 10, bold: true, color: { argb: XLSX_COLORS.ink } };
    for (const d of days) {
      const status = attendanceMap.get(`${p.id}_${dateOf(d)}`);
      const cell = row.getCell(`d${d}`);
      if (status) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[status] } };
      else if (isFriday(dateOf(d)) || closed.has(dateOf(d))) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
    }
  });

  return workbook;
}
