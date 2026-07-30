import { createClient } from "@/lib/supabase/server";
import type { AuditLog } from "@/lib/types";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";

const ACTION_LABEL: Record<string, string> = {
  "job.status_change": "Changed job status",
  "invoice.create": "Created invoice",
  "estimate.create": "Created estimate",
  "estimate.convert_to_invoice": "Converted estimate to invoice",
  "invoice_item.add": "Added invoice item",
  "invoice_item.delete": "Removed invoice item",
  "invoice.discount_update": "Updated discount",
  "payment.record": "Recorded payment",
  "payment.delete": "Removed payment",
  "expense.create": "Recorded expense",
  "expense.update": "Updated expense",
  "customer.balance_adjustment": "Added balance adjustment",
  "customer.balance_adjustment_delete": "Removed balance adjustment",
  "job.sublet_add": "Added sublet/outsourced cost",
  "job.sublet_delete": "Removed sublet/outsourced cost",
  "expense.delete": "Removed expense",
  "staff.create": "Added staff member",
  "staff.update": "Updated staff member",
  "staff.delete": "Removed staff member",
  "purchase_order.create": "Created purchase order",
  "purchase_order.status_change": "Updated purchase order",
  "part.stock_adjust": "Adjusted stock",
};

const ACTION_COLOR: Record<string, "green" | "amber" | "red" | "blue" | "slate"> = {
  create: "green",
  add: "green",
  record: "green",
  status_change: "blue",
  update: "amber",
  discount_update: "amber",
  stock_adjust: "amber",
  delete: "red",
};

function colorForAction(action: string): "green" | "amber" | "red" | "blue" | "slate" {
  const suffix = action.split(".")[1] ?? "";
  return ACTION_COLOR[suffix] ?? "slate";
}

function summarizeDetails(details: Record<string, unknown> | null) {
  if (!details) return null;
  try {
    return Object.entries(details)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
  } catch {
    return null;
  }
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; actor?: string; action?: string; from?: string; to?: string }>;
}) {
  const { page, actor, action, from, to } = await searchParams;
  const pageNum = Math.max(1, Number(page ?? 1));
  const pageSize = 50;

  const supabase = await createClient();

  const { data: actors } = await supabase
    .from("audit_log")
    .select("actor_name")
    .order("actor_name");
  const uniqueActors = [...new Set((actors ?? []).map((a) => a.actor_name))];

  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (actor) query = query.eq("actor_name", actor);
  if (action) query = query.eq("action", action);
  if (from) query = query.gte("created_at", new Date(from).toISOString());
  if (to) {
    const toEnd = new Date(to);
    toEnd.setDate(toEnd.getDate() + 1);
    query = query.lt("created_at", toEnd.toISOString());
  }

  const { data: logs, error, count } = await query
    .range((pageNum - 1) * pageSize, pageNum * pageSize - 1)
    .returns<AuditLog[]>();

  const totalPages = count ? Math.ceil(count / pageSize) : 1;
  const hasFilters = Boolean(actor || action || from || to);

  const filterParams = new URLSearchParams();
  if (actor) filterParams.set("actor", actor);
  if (action) filterParams.set("action", action);
  if (from) filterParams.set("from", from);
  if (to) filterParams.set("to", to);
  const filterQS = filterParams.toString();

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title="Audit Log" description="Who changed what, across the whole system." />

      <form className="flex flex-wrap items-end gap-2 mb-4 text-sm">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Staff</span>
          <select name="actor" defaultValue={actor ?? ""} className="rounded-lg border border-slate-300 px-2 py-1.5">
            <option value="">All staff</option>
            {uniqueActors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Action</span>
          <select name="action" defaultValue={action ?? ""} className="rounded-lg border border-slate-300 px-2 py-1.5">
            <option value="">All actions</option>
            {Object.entries(ACTION_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">From</span>
          <input type="date" name="from" defaultValue={from ?? ""} className="rounded-lg border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">To</span>
          <input type="date" name="to" defaultValue={to ?? ""} className="rounded-lg border border-slate-300 px-2 py-1.5" />
        </label>
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
          Filter
        </button>
        {hasFilters && (
          <a href="/audit-log" className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-500 hover:bg-slate-50">
            Clear
          </a>
        )}
      </form>

      {error && <p className="text-red-600 text-sm mb-4">Failed to load audit log: {error.message}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Staff</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs?.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">{log.actor_name}</td>
                <td className="px-4 py-2.5">
                  <Badge color={colorForAction(log.action)}>{ACTION_LABEL[log.action] ?? log.action}</Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{summarizeDetails(log.details) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs?.length === 0 && (
          <EmptyState message={hasFilters ? "No matching audit activity." : "No audit activity yet."} />
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4 text-sm">
          {pageNum > 1 && (
            <a
              href={`/audit-log?${filterQS ? `${filterQS}&` : ""}page=${pageNum - 1}`}
              className="text-indigo-600 hover:underline"
            >
              &larr; Newer
            </a>
          )}
          <span className="text-slate-400">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages && (
            <a
              href={`/audit-log?${filterQS ? `${filterQS}&` : ""}page=${pageNum + 1}`}
              className="text-indigo-600 hover:underline"
            >
              Older &rarr;
            </a>
          )}
        </div>
      )}
    </div>
  );
}
