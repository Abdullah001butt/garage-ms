"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function saveCashReconciliation(formData: FormData) {
  const supabase = await createClient();

  const reconciliation_date = String(formData.get("reconciliation_date") ?? "").trim();
  const counted_cash = Number(formData.get("counted_cash") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!reconciliation_date || counted_cash < 0) {
    throw new Error("Date and counted cash are required.");
  }

  const { error } = await supabase
    .from("daily_cash_reconciliations")
    .upsert(
      { reconciliation_date, counted_cash, notes },
      { onConflict: "reconciliation_date" }
    );

  if (error) {
    throw new Error(error.message);
  }

  await logAudit("cash.reconciliation_save", "daily_cash_reconciliation", null, {
    reconciliation_date,
    counted_cash,
  });

  revalidatePath("/reports/daily-cashflow");
}
