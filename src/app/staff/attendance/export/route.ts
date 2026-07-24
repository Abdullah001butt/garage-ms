import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyHeaderRow, CURRENCY_FORMAT, xlsxResponse } from "@/lib/xlsx-style";
import type { Attendance, AttendanceStatus, Profile } from "@/lib/types";

const STATUS_FILL: Record<string, string> = {
  present: "FFD1FAE5",
  absent: "FFFEE2E2",
  paid_leave: "FFDBEAFE",
  holiday: "FFE2E8F0",
};

const STATUS_ABBR: Record<string, string> = {
  present: "P",
  absent: "A",
  paid_leave: "L",
  holiday: "H",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;

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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Al Bahir Garage";
  const sheet = workbook.addWorksheet(`Attendance ${month}`, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  sheet.columns = [
    { header: "Staff", key: "staff", width: 22 },
    ...days.map((d) => ({ header: String(d), key: `d${d}`, width: 4 })),
    { header: "Present", key: "present", width: 10 },
    { header: "Salary (AED)", key: "salary", width: 16, style: { numFmt: CURRENCY_FORMAT } },
  ];
  applyHeaderRow(sheet.getRow(1));

  for (const p of profiles ?? []) {
    let presentCount = 0;
    let paidLeaveCount = 0;
    const rowData: Record<string, string | number> = { staff: p.full_name };

    for (const d of days) {
      const dateStr = `${month}-${String(d).padStart(2, "0")}`;
      const status = attendanceMap.get(`${p.id}_${dateStr}`);
      if (status === "present") presentCount++;
      if (status === "paid_leave") paidLeaveCount++;
      rowData[`d${d}`] = status ? STATUS_ABBR[status] : "";
    }

    const dailyRate = p.monthly_salary ? p.monthly_salary / daysInMonth : 0;
    const salary = dailyRate * (presentCount + paidLeaveCount);
    rowData.present = presentCount + paidLeaveCount;
    rowData.salary = p.monthly_salary ? salary : 0;

    const row = sheet.addRow(rowData);
    row.getCell("staff").font = { bold: true };

    for (const d of days) {
      const dateStr = `${month}-${String(d).padStart(2, "0")}`;
      const status = attendanceMap.get(`${p.id}_${dateStr}`);
      const cell = row.getCell(`d${d}`);
      cell.alignment = { horizontal: "center" };
      if (status) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[status] } };
      }
    }
    row.getCell("present").alignment = { horizontal: "center" };
    row.getCell("present").font = { bold: true };
    row.getCell("salary").font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return xlsxResponse(buffer, `attendance-${month}.xlsx`);
}
