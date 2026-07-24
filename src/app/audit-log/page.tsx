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
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page ?? 1));
  const pageSize = 50;

  const supabase = await createClient();
  const { data: logs, error, count } = await supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((pageNum - 1) * pageSize, pageNum * pageSize - 1)
    .returns<AuditLog[]>();

  const totalPages = count ? Math.ceil(count / pageSize) : 1;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title="Audit Log" description="Who changed what, across the whole system." />

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
        {logs?.length === 0 && <EmptyState message="No audit activity yet." />}
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4 text-sm">
          {pageNum > 1 && (
            <a href={`/audit-log?page=${pageNum - 1}`} className="text-indigo-600 hover:underline">
              &larr; Newer
            </a>
          )}
          <span className="text-slate-400">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages && (
            <a href={`/audit-log?page=${pageNum + 1}`} className="text-indigo-600 hover:underline">
              Older &rarr;
            </a>
          )}
        </div>
      )}
    </div>
  );
}
