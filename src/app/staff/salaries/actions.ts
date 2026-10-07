"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { dayKey } from "@/lib/format";
import { computeSalary, monthBounds, monthLabel } from "@/lib/salary";
import type { AttendanceStatus } from "@/lib/types";

function refresh() {
  revalidatePath("/staff/salaries");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports/daily-cashflow");
  revalidatePath("/reports/profit-loss");
}

export async function addStaffAdvance(formData: FormData) {
  const supabase = await createClient();
  const profile_id = String(formData.get("profile_id") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const advance_date = String(formData.get("advance_date") ?? "").trim() || dayKey(new Date());
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!profile_id || !(amount > 0)) {
    throw new Error("Choose a staff member and enter an amount.");
  }

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", profile_id).maybeSingle();

  // The cash leaves the drawer today, so it is an expense today (category Salaries).
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      category: "Salaries",
      description: `Advance — ${profile?.full_name ?? "staff"}${note ? ` (${note})` : ""}`,
      amount,
      expense_date: advance_date,
    })
    .select("id")
    .single();
  if (expenseError) throw new Error(expenseError.message);

  const { error } = await supabase
    .from("staff_advances")
    .insert({ profile_id, amount, advance_date, note, expense_id: expense.id });
  if (error) {
    await supabase.from("expenses").delete().eq("id", expense.id);
    throw new Error(error.message);
  }

  await logAudit("staff.advance_add", "staff", profile_id, { amount, advance_date, name: profile?.full_name });
  refresh();
}

export async function deleteStaffAdvance(advanceId: string) {
  const supabase = await createClient();
  const { data: advance } = await supabase.from("staff_advances").select("*").eq("id", advanceId).maybeSingle();
  if (!advance) return;

  const { error } = await supabase.from("staff_advances").delete().eq("id", advanceId);
  if (error) throw new Error(error.message);
  if (advance.expense_id) await supabase.from("expenses").delete().eq("id", advance.expense_id);

  await logAudit("staff.advance_delete", "staff", advance.profile_id, { amount: advance.amount, advance_date: advance.advance_date });
  refresh();
}

export async function paySalary(profileId: string, month: string, formData: FormData) {
  const supabase = await createClient();
  const bonus = Number(formData.get("bonus") || 0);
  const other_deduction = Number(formData.get("other_deduction") || 0);
  const method = String(formData.get("method") ?? "cash");
  const note = String(formData.get("note") ?? "").trim() || null;
  const { start, end } = monthBounds(month);

  // Recalculate on the server from the database, never from numbers sent by the browser.
  const [{ data: profile }, { data: attendance }, { data: holidays }, { data: advances }] = await Promise.all([
    supabase.from("profiles").select("full_name, monthly_salary").eq("id", profileId).single(),
    supabase.from("attendance").select("status").eq("profile_id", profileId).gte("attendance_date", start).lte("attendance_date", end),
    supabase.from("shop_holidays").select("holiday_date").gte("holiday_date", start).lte("holiday_date", end),
    supabase.from("staff_advances").select("amount").eq("profile_id", profileId).gte("advance_date", start).lte("advance_date", end),
  ]);
  if (!profile) throw new Error("Staff member not found.");

  const line = computeSalary({
    baseSalary: Number(profile.monthly_salary ?? 0),
    month,
    holidayDates: (holidays ?? []).map((h) => h.holiday_date),
    statuses: (attendance ?? []).map((a) => a.status as AttendanceStatus),
    advances: (advances ?? []).reduce((s, a) => s + Number(a.amount), 0),
  });
  const net_pay = Math.round((line.net + bonus - other_deduction) * 100) / 100;

  let expenseId: string | null = null;
  if (net_pay > 0) {
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        category: "Salaries",
        description: `Salary ${monthLabel(month)} — ${profile.full_name}`,
        amount: net_pay,
        expense_date: dayKey(new Date()),
      })
      .select("id")
      .single();
    if (expenseError) throw new Error(expenseError.message);
    expenseId = expense.id;
  }

  const { error } = await supabase.from("salary_payments").insert({
    profile_id: profileId,
    month,
    base_salary: line.baseSalary,
    working_days: line.workingDays,
    absent_days: line.absentDays,
    absence_deduction: line.absenceDeduction,
    advances: line.advances,
    bonus,
    other_deduction,
    net_pay,
    method,
    note,
    expense_id: expenseId,
  });
  if (error) {
    if (expenseId) await supabase.from("expenses").delete().eq("id", expenseId);
    throw new Error(error.code === "23505" ? "This month's salary is already marked as paid." : error.message);
  }

  await logAudit("salary.pay", "staff", profileId, { month, net_pay, name: profile.full_name });
  refresh();
}

export async function undoSalaryPayment(paymentId: string) {
  const supabase = await createClient();
  const { data: payment } = await supabase.from("salary_payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment) return;

  const { error } = await supabase.from("salary_payments").delete().eq("id", paymentId);
  if (error) throw new Error(error.message);
  if (payment.expense_id) await supabase.from("expenses").delete().eq("id", payment.expense_id);

  await logAudit("salary.undo", "staff", payment.profile_id, { month: payment.month, net_pay: payment.net_pay });
  refresh();
}
