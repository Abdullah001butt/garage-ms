"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateWeeklyInsights } from "@/lib/gemini";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function generateAndSaveWeeklyInsights() {
  const supabase = await createClient();

  const weekStart = daysAgo(7);
  const twoWeeksStart = daysAgo(14);

  const [{ data: payments }, { data: expenses }, { data: invoices }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, paid_at")
      .gte("paid_at", twoWeeksStart.toISOString()),
    supabase
      .from("expenses")
      .select("amount, expense_date, category")
      .gte("expense_date", twoWeeksStart.toISOString()),
    supabase
      .from("invoices")
      .select("id, created_at, document_type, invoice_items(description, item_type, quantity, unit_price)")
      .eq("document_type", "invoice")
      .gte("created_at", twoWeeksStart.toISOString()),
  ]);

  const thisWeekPayments = (payments ?? []).filter((p) => new Date(p.paid_at) >= weekStart);
  const lastWeekPayments = (payments ?? []).filter((p) => new Date(p.paid_at) < weekStart);
  const revenueThisWeek = thisWeekPayments.reduce((s, p) => s + Number(p.amount), 0);
  const revenueLastWeek = lastWeekPayments.reduce((s, p) => s + Number(p.amount), 0);

  const thisWeekExpenses = (expenses ?? []).filter((e) => new Date(e.expense_date) >= weekStart);
  const expensesThisWeek = thisWeekExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const thisWeekInvoices = (invoices ?? []).filter((i) => new Date(i.created_at) >= weekStart);

  const itemTotals = new Map<string, number>();
  for (const inv of thisWeekInvoices) {
    for (const item of inv.invoice_items ?? []) {
      const total = item.quantity * item.unit_price;
      itemTotals.set(item.description, (itemTotals.get(item.description) ?? 0) + total);
    }
  }
  const topItems = [...itemTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([desc, total]) => `${desc}: AED ${total.toFixed(0)}`)
    .join(", ");

  const dataSummary = `
Revenue this week: AED ${revenueThisWeek.toFixed(0)} (${thisWeekPayments.length} payments)
Revenue last week: AED ${revenueLastWeek.toFixed(0)}
Expenses this week: AED ${expensesThisWeek.toFixed(0)}
Invoices created this week: ${thisWeekInvoices.length}
Top revenue line items this week: ${topItems || "none"}
`.trim();

  const content = await generateWeeklyInsights(dataSummary);

  const { error } = await supabase.from("weekly_insights").insert({
    content,
    week_start: weekStart.toISOString().slice(0, 10),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
}
