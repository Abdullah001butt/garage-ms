import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, StatCard, Badge, EmptyState } from "@/components/ui";
import { MonthlyTrendChart, type MonthlyTrendPoint } from "@/components/MonthlyTrendChart";

type InvoiceRow = {
  id: string;
  status: "unpaid" | "partial" | "paid";
  document_type: "estimate" | "invoice";
  vat_rate: number;
  created_at: string;
  paid_at: string | null;
  invoice_items: { item_type: "part" | "labor"; quantity: number; unit_price: number }[];
};

type JobRow = {
  id: string;
  status: "pending" | "in_progress" | "completed";
  mechanic_name: string | null;
  created_at: string;
  completed_at: string | null;
};

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: jobs }, { data: expenses }, { data: parts }, { data: pos }, { data: payments }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, status, document_type, vat_rate, created_at, paid_at, invoice_items(item_type, quantity, unit_price)")
        .returns<InvoiceRow[]>(),
      supabase
        .from("job_cards")
        .select("id, status, mechanic_name, created_at, completed_at")
        .returns<JobRow[]>(),
      supabase.from("expenses").select("amount, expense_date"),
      supabase.from("parts").select("id, stock_qty, reorder_threshold"),
      supabase.from("purchase_orders").select("id, status"),
      supabase.from("payments").select("amount, paid_at"),
    ]);

  const realInvoices = (invoices ?? []).filter((i) => i.document_type === "invoice");
  const invoiceTotal = (inv: InvoiceRow) => {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    return subtotal * (1 + inv.vat_rate / 100);
  };

  const revenueThisMonth = (payments ?? [])
    .filter((p) => isThisMonth(p.paid_at))
    .reduce((s, p) => s + Number(p.amount), 0);

  const aro = realInvoices.length
    ? realInvoices.reduce((s, i) => s + invoiceTotal(i), 0) / realInvoices.length
    : 0;

  const laborTotal = realInvoices.reduce(
    (s, i) => s + i.invoice_items.filter((it) => it.item_type === "labor").reduce((a, it) => a + it.quantity * it.unit_price, 0),
    0
  );
  const partsTotal = realInvoices.reduce(
    (s, i) => s + i.invoice_items.filter((it) => it.item_type === "part").reduce((a, it) => a + it.quantity * it.unit_price, 0),
    0
  );

  const expensesThisMonth = (expenses ?? [])
    .filter((e) => isThisMonth(e.expense_date))
    .reduce((s, e) => s + Number(e.amount), 0);

  const netThisMonth = revenueThisMonth - expensesThisMonth;

  const jobCounts = {
    pending: (jobs ?? []).filter((j) => j.status === "pending").length,
    in_progress: (jobs ?? []).filter((j) => j.status === "in_progress").length,
    completed: (jobs ?? []).filter((j) => j.status === "completed").length,
  };
  const activeJobs = jobCounts.pending + jobCounts.in_progress;
  const utilization = jobs?.length ? Math.round(((jobCounts.in_progress) / (activeJobs || 1)) * 100) : 0;

  const mechanicStats = new Map<string, { count: number; totalHours: number }>();
  for (const job of jobs ?? []) {
    if (job.status !== "completed" || !job.mechanic_name || !job.completed_at) continue;
    const hours = (new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 3600000;
    const entry = mechanicStats.get(job.mechanic_name) ?? { count: 0, totalHours: 0 };
    entry.count += 1;
    entry.totalHours += hours;
    mechanicStats.set(job.mechanic_name, entry);
  }
  const mechanicRows = [...mechanicStats.entries()].map(([name, s]) => ({
    name,
    completed: s.count,
    avgHours: s.totalHours / s.count,
  }));

  const lowStockCount = (parts ?? []).filter((p) => p.stock_qty <= p.reorder_threshold).length;
  const pendingPOs = (pos ?? []).filter((p) => p.status === "pending" || p.status === "ordered").length;

  const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const now = new Date();
  const monthKeys = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), key: `${d.getFullYear()}-${d.getMonth()}` };
  });

  const monthlyTrend: MonthlyTrendPoint[] = monthKeys.map(({ year, month, key }) => {
    const revenue = (payments ?? [])
      .filter((p) => {
        const d = new Date(p.paid_at);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, p) => s + Number(p.amount), 0);
    const monthExpenses = (expenses ?? [])
      .filter((e) => {
        const d = new Date(e.expense_date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, e) => s + Number(e.amount), 0);
    return {
      month: key,
      label: `${MONTH_LABELS[month]} ${String(year).slice(2)}`,
      revenue: Math.round(revenue),
      expenses: Math.round(monthExpenses),
      net: Math.round(revenue - monthExpenses),
    };
  });

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <PageHeader title="Dashboard" description="Live performance and financial overview." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenue (this month)" value={`AED ${revenueThisMonth.toFixed(0)}`} accent="green" hint="Cash actually received" />
        <StatCard label="Avg. Repair Order (ARO)" value={`AED ${aro.toFixed(0)}`} accent="indigo" hint={`Across ${realInvoices.length} invoices`} />
        <StatCard label="Expenses (this month)" value={`AED ${expensesThisMonth.toFixed(0)}`} accent="red" />
        <StatCard
          label="Net (this month)"
          value={`AED ${netThisMonth.toFixed(0)}`}
          accent={netThisMonth >= 0 ? "green" : "red"}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Jobs" value={String(activeJobs)} hint={`${jobCounts.pending} pending · ${jobCounts.in_progress} in progress`} />
        <StatCard label="Shop Utilization" value={`${utilization}%`} hint="Share of active jobs in progress" />
        <StatCard label="Low Stock Parts" value={String(lowStockCount)} accent={lowStockCount > 0 ? "amber" : "slate"} />
        <StatCard label="Open Purchase Orders" value={String(pendingPOs)} />
      </div>

      <Card className="p-5 mb-8">
        <p className="text-sm font-semibold text-slate-700 mb-4">Last 6 Months: Revenue vs Expenses</p>
        <MonthlyTrendChart data={monthlyTrend} />
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Revenue Split: Labor vs Parts</p>
          <div className="space-y-3">
            <RevenueBar label="Labor" value={laborTotal} total={laborTotal + partsTotal} color="bg-indigo-500" />
            <RevenueBar label="Parts" value={partsTotal} total={laborTotal + partsTotal} color="bg-emerald-500" />
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Technician Efficiency</p>
          {mechanicRows.length === 0 ? (
            <EmptyState message="No completed jobs with a mechanic assigned yet." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2 font-medium">Mechanic</th>
                  <th className="pb-2 font-medium text-right">Completed</th>
                  <th className="pb-2 font-medium text-right">Avg. Turnaround</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mechanicRows.map((m) => (
                  <tr key={m.name}>
                    <td className="py-2 font-medium text-slate-900">{m.name}</td>
                    <td className="py-2 text-right">{m.completed}</td>
                    <td className="py-2 text-right">{m.avgHours.toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Job Status Breakdown</p>
          <div className="flex gap-3">
            <Badge color="gray">{jobCounts.pending} Pending</Badge>
            <Badge color="amber">{jobCounts.in_progress} In Progress</Badge>
            <Badge color="green">{jobCounts.completed} Completed</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RevenueBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">AED {value.toFixed(0)} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
