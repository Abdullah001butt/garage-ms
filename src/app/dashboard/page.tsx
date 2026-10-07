import { formatDateTime, formatMonth } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Panel, PanelEmpty, SecondaryButton, theadClass, thClass } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { MonthlyTrendChart, type MonthlyTrendPoint } from "@/components/MonthlyTrendChart";
import { GenerateInsightsButton } from "@/components/GenerateInsightsButton";
import { generateAndSaveWeeklyInsights } from "@/app/dashboard/insights-actions";

type InvoiceRow = {
  id: string;
  status: "unpaid" | "partial" | "paid";
  document_type: "estimate" | "invoice";
  vat_rate: number;
  created_at: string;
  paid_at: string | null;
  customer_id: string | null;
  customers: { name: string } | null;
  invoice_items: { item_type: "part" | "labor" | "service"; quantity: number; unit_price: number }[];
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

  const [{ data: invoices }, { data: jobs }, { data: expenses }, { data: parts }, { data: pos }, { data: payments }, { data: latestInsight }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, status, document_type, vat_rate, created_at, paid_at, customer_id, customers(name), invoice_items(item_type, quantity, unit_price)"
        )
        .returns<InvoiceRow[]>(),
      supabase
        .from("job_cards")
        .select("id, status, mechanic_name, created_at, completed_at")
        .returns<JobRow[]>(),
      supabase.from("expenses").select("amount, expense_date"),
      supabase.from("parts").select("id, stock_qty, reorder_threshold"),
      supabase.from("purchase_orders").select("id, status"),
      supabase.from("payments").select("amount, paid_at"),
      supabase
        .from("weekly_insights")
        .select("content, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
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
  const serviceTotal = realInvoices.reduce(
    (s, i) => s + i.invoice_items.filter((it) => it.item_type === "service").reduce((a, it) => a + it.quantity * it.unit_price, 0),
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

  type CustomerAgg = { name: string; total: number; visits: number };
  function topCustomers(invs: InvoiceRow[], limit: number): CustomerAgg[] {
    const map = new Map<string, CustomerAgg>();
    for (const inv of invs) {
      if (!inv.customer_id || !inv.customers?.name) continue;
      const entry = map.get(inv.customer_id) ?? { name: inv.customers.name, total: 0, visits: 0 };
      entry.total += invoiceTotal(inv);
      entry.visits += 1;
      map.set(inv.customer_id, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
  }
  const topCustomersThisMonth = topCustomers(realInvoices.filter((i) => isThisMonth(i.created_at)), 5);
  const topCustomersAllTime = topCustomers(realInvoices, 5);

  const thisMonthDate = new Date();
  const lastYear = thisMonthDate.getFullYear() - 1;
  const revenueSameMonthLastYear = (payments ?? [])
    .filter((p) => {
      const d = new Date(p.paid_at);
      return d.getFullYear() === lastYear && d.getMonth() === thisMonthDate.getMonth();
    })
    .reduce((s, p) => s + Number(p.amount), 0);
  const yoyChangePct =
    revenueSameMonthLastYear > 0
      ? ((revenueThisMonth - revenueSameMonthLastYear) / revenueSameMonthLastYear) * 100
      : null;

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

  const mixTotal = laborTotal + partsTotal + serviceTotal;
  const monthLabel = formatMonth(new Date());
  const totalJobs = jobCounts.pending + jobCounts.in_progress + jobCounts.completed;

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description={`Business performance · ${monthLabel}`}
        action={
          <a href="/reports/monthly-summary/export">
            <SecondaryButton type="button" icon="download">
              Export month
            </SecondaryButton>
          </a>
        }
      />

      <Card className="grid grid-cols-2 lg:grid-cols-4">
        <Metric label="Revenue this month" value={aed(revenueThisMonth)} hint="Cash actually received" delta={yoyChangePct} />
        <Metric label="Expenses this month" value={aed(expensesThisMonth)} hint="Recorded expenses" className="border-l border-zinc-200" />
        <Metric
          label="Net this month"
          value={aed(netThisMonth)}
          hint="Revenue minus expenses"
          tone={netThisMonth >= 0 ? "positive" : "negative"}
          className="border-t border-zinc-200 lg:border-t-0 lg:border-l"
        />
        <Metric
          label="Average repair order"
          value={aed(aro)}
          hint={`Across ${realInvoices.length} invoices`}
          className="border-t border-l border-zinc-200 lg:border-t-0"
        />
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon="wrench" label="Active jobs" value={String(activeJobs)} hint={`${jobCounts.pending} pending · ${jobCounts.in_progress} in progress`} />
        <MiniStat icon="trending" label="Shop utilisation" value={`${utilization}%`} hint="Active jobs being worked on" />
        <MiniStat icon="package" label="Low stock parts" value={String(lowStockCount)} hint="At or below reorder level" warn={lowStockCount > 0} />
        <MiniStat icon="receipt" label="Open purchase orders" value={String(pendingPOs)} hint="Pending or ordered" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Revenue vs expenses" action={<span className="text-xs text-zinc-500">Last 6 months</span>} className="lg:col-span-2">
          <div className="p-4">
            <MonthlyTrendChart data={monthlyTrend} />
          </div>
        </Panel>

        <Panel title="Revenue mix" action={<span className="text-xs text-zinc-500">All invoices</span>}>
          <div className="space-y-4 p-4">
            <p className="text-2xl font-semibold tracking-tight text-zinc-900 tabular">{aed(mixTotal)}</p>
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-zinc-100">
              {mixTotal > 0 && (
                <>
                  <div className="bg-zinc-900" style={{ width: `${(laborTotal / mixTotal) * 100}%` }} />
                  <div className="bg-brand-500" style={{ width: `${(partsTotal / mixTotal) * 100}%` }} />
                  <div className="bg-zinc-400" style={{ width: `${(serviceTotal / mixTotal) * 100}%` }} />
                </>
              )}
            </div>
            <div className="space-y-2.5">
              <RevenueBar label="Labour" value={laborTotal} total={mixTotal} color="bg-zinc-900" />
              <RevenueBar label="Parts" value={partsTotal} total={mixTotal} color="bg-brand-500" />
              <RevenueBar label="Services" value={serviceTotal} total={mixTotal} color="bg-zinc-400" />
            </div>
            <div className="border-t border-zinc-100 pt-3">
              <p className="mb-2 text-xs font-medium text-zinc-500">Job pipeline · {totalJobs} total</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <PipelineCount label="Pending" value={jobCounts.pending} dot="bg-zinc-400" />
                <PipelineCount label="In progress" value={jobCounts.in_progress} dot="bg-amber-500" />
                <PipelineCount label="Completed" value={jobCounts.completed} dot="bg-emerald-500" />
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Technician performance">
          {mechanicRows.length === 0 ? (
            <PanelEmpty message="No completed jobs with a mechanic assigned yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Mechanic</th>
                  <th className={`${thClass} text-right`}>Jobs</th>
                  <th className={`${thClass} text-right`}>Avg. time</th>
                </tr>
              </thead>
              <tbody>
                {[...mechanicRows]
                  .sort((x, y) => y.completed - x.completed)
                  .map((m) => (
                    <tr key={m.name} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-zinc-900">{m.name}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-700 tabular">{m.completed}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-700 tabular">{m.avgHours.toFixed(1)}h</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Panel>

        <TopCustomersPanel title="Top customers · this month" rows={topCustomersThisMonth} empty="No invoices this month yet." />
        <TopCustomersPanel title="Top customers · all time" rows={topCustomersAllTime} empty="No invoices yet." />
      </div>

      <Panel title="Weekly summary" className="mt-6" action={<GenerateInsightsButton action={generateAndSaveWeeklyInsights} />}>
        {latestInsight ? (
          <div className="flex gap-3 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
              <Icon name="sparkles" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-zinc-700">{latestInsight.content}</p>
              <p className="mt-2 text-xs text-zinc-400">Generated {formatDateTime(latestInsight.created_at)}</p>
            </div>
          </div>
        ) : (
          <PanelEmpty message="No summary yet. Generate one for an AI-written overview of this week's business." />
        )}
      </Panel>
    </div>
  );
}

function aed(amount: number) {
  return `AED ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function Metric({
  label,
  value,
  hint,
  delta,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  tone?: "positive" | "negative";
  className?: string;
}) {
  return (
    <div className={`p-4 sm:p-5 ${className}`}>
      <p className="text-[13px] font-medium text-zinc-500">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
        <p
          className={`text-2xl font-semibold tracking-tight tabular ${
            tone === "negative" ? "text-red-700" : tone === "positive" ? "text-emerald-700" : "text-zinc-900"
          }`}
        >
          {value}
        </p>
        {delta !== undefined && delta !== null && (
          <span
            className={`rounded px-1 py-px text-xs font-medium tabular ${
              delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {delta >= 0 ? "+" : "−"}
            {Math.abs(delta).toFixed(0)}% YoY
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  hint,
  warn = false,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <span className="hidden h-9 w-9 shrink-0 sm:flex items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="line-clamp-2 text-xs font-medium text-zinc-500 sm:truncate">{label}</p>
        <p className={`text-lg font-semibold leading-tight tabular ${warn ? "text-amber-700" : "text-zinc-900"}`}>{value}</p>
        <p className="line-clamp-2 text-[11px] text-zinc-400 sm:truncate">{hint}</p>
      </div>
    </Card>
  );
}

function PipelineCount({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-2">
      <p className="text-base font-semibold text-zinc-900 tabular">{value}</p>
      <p className="flex items-center justify-center gap-1 text-[11px] text-zinc-500">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </p>
    </div>
  );
}

function TopCustomersPanel({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { name: string; total: number; visits: number }[];
  empty: string;
}) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <PanelEmpty message={empty} />
      ) : (
        <ol className="divide-y divide-zinc-100">
          {rows.map((c, i) => (
            <li key={c.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-4 text-xs font-medium text-zinc-400 tabular">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">{c.name}</span>
              <span className="shrink-0 text-right">
                <span className="block font-medium text-zinc-900 tabular">{aed(c.total)}</span>
                <span className="block text-[11px] text-zinc-500">
                  {c.visits} visit{c.visits > 1 ? "s" : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
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
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-zinc-600">
          <span className={`h-2 w-2 rounded-sm ${color}`} />
          {label}
        </span>
        <span className="text-zinc-900 tabular">
          {aed(value)} <span className="text-zinc-400">· {pct}%</span>
        </span>
      </div>
    </div>
  );
}
