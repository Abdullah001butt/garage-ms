import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dayKey } from "@/lib/format";
import { isoBounds } from "@/lib/date-range";

export const dynamic = "force-dynamic";

export type NavCount = { count: number; tone: "neutral" | "red" | "amber" | "blue"; title: string };

/** Small numbers for the sidebar: what needs attention, without opening each page. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401 });

  const today = dayKey(new Date());
  const { start, end } = isoBounds(today, today);
  const head = { count: "exact" as const, head: true };
  const [openJobs, uninvoiced, invoiced, unpaid, parts, appts, pos] = await Promise.all([
    supabase.from("job_cards").select("id", head).in("status", ["pending", "in_progress"]),
    supabase.from("job_cards").select("id").eq("status", "completed"),
    supabase.from("invoices").select("job_card_id").not("job_card_id", "is", null),
    supabase.from("invoices").select("id", head).eq("document_type", "invoice").in("status", ["unpaid", "partial"]),
    supabase.from("parts").select("stock_qty, reorder_threshold"),
    supabase.from("appointments").select("id", head).eq("status", "scheduled").gte("scheduled_at", start).lte("scheduled_at", end),
    supabase.from("purchase_orders").select("id", head).in("status", ["pending", "ordered"]),
  ]);

  const invoicedJobs = new Set((invoiced.data ?? []).map((i) => i.job_card_id));
  const needsInvoice = (uninvoiced.data ?? []).filter((j) => !invoicedJobs.has(j.id)).length;
  const low = (parts.data ?? []).filter((p) => Number(p.stock_qty) <= Number(p.reorder_threshold)).length;
  const open = openJobs.count ?? 0;

  const out: Record<string, NavCount> = {};
  if (open || needsInvoice)
    out["/jobs"] = {
      count: open + needsInvoice,
      tone: needsInvoice ? "amber" : "neutral",
      title: [open && `${open} in the workshop`, needsInvoice && `${needsInvoice} finished, not invoiced`].filter(Boolean).join(" · "),
    };
  if (appts.count) out["/appointments"] = { count: appts.count, tone: "blue", title: `${appts.count} booked for today` };
  if (unpaid.count) out["/invoices"] = { count: unpaid.count, tone: "red", title: `${unpaid.count} unpaid or part paid` };
  if (low) out["/inventory"] = { count: low, tone: "amber", title: `${low} at or below reorder level` };
  if (pos.count) out["/purchase-orders"] = { count: pos.count, tone: "neutral", title: `${pos.count} waiting to arrive` };

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
