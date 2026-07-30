import type { AttendanceStatus } from "@/lib/types";

export const ATTENDANCE_CYCLE: Record<string, AttendanceStatus> = {
  none: "present",
  present: "absent",
  absent: "paid_leave",
  paid_leave: "holiday",
  holiday: "present",
};
