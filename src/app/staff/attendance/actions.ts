"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/types";
import { ATTENDANCE_CYCLE } from "@/lib/attendance-cycle";

export async function cycleAttendance(
  profileId: string,
  date: string,
  currentStatus: AttendanceStatus | "none"
) {
  const supabase = await createClient();
  const nextStatus = ATTENDANCE_CYCLE[currentStatus];

  const { error } = await supabase
    .from("attendance")
    .upsert(
      { profile_id: profileId, attendance_date: date, status: nextStatus },
      { onConflict: "profile_id,attendance_date" }
    );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/staff/attendance");
}
