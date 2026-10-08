import { dayKey, formatDateTime } from "@/lib/format";
import { buckets, inRange, resolveRange, spanLabel } from "@/lib/date-range";
import { DateRangePicker } from "@/components/DateRangePicker";
import { StatStrip, pctChange } from "@/components/report-ui";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Panel, PanelEmpty, SecondaryButton, theadClass, thClass } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { MonthlyTrendChart, type MonthlyTrendPoint } from "@/components/MonthlyTrendChart";
import { GenerateInsightsButton } from "@/components/GenerateInsightsButton";
import { generateAndSaveWeeklyInsights } from "@/app/dashboard/insights-actions";
import { saveDashboardLayout } from "@/app/dashboard/layout-actions";
import { CustomizeDashboardButton, DashboardGrid, type DashboardWidget } from "@/components/DashboardGrid";
import { defaultLayout, resolveLayout } from "@/lib/dashboard-layout";
import { invoiceFigures } from "@/lib/invoice-math";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { PlateBadge } from "@/components/PlateBadge";
import Link from "next/link";
import { RevenueHeatmap, type HeatmapDay } from "@/components/RevenueHeatmap";

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

type OwingRow = {
  id: string;
  vat_rate: number;
  discount: number;
  customers: { id: string; name: string } | null;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
  credit_notes: { amount: number }[];
};
type RecentPaymentRow = {
  id: string;
  amount: number;
  method: string;
  paid_at: string;
  invoices: { id: string; invoice_number: number | null; created_at: string; customers: { name: string } | null } | null;
};
type OpenJobRow = {
  id: string;
  status: "pending" | "in_progress";
  description: string;
  created_at: string;
  vehicles: { plate_number: string; emirate: string; make: string | null; model: string | null } | null;
  customers: { name: string } | null;
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const range = resolveRange(await searchParams, "month");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [
    { data: invoices },
    { data: jobs },
    { data: expenses },
    { data: parts },
    { data: pos },
    { data: payments },
    { data: latestInsight },
    { data: customers },
    { data: prefs },
    { data: owing },
    { data: recentPayments },
    { data: openJobs },
  ] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, status, document_type, vat_rate, created_at, paid_at, customer_id, customers(name), invoice_items(item_type, quantity, unit_price)")
        .returns<InvoiceRow[]>(),
      supabase.from("job_cards").select("id, status, mechanic_name, created_at, completed_at").returns<JobRow[]>(),
      supabase.from("expenses").select("amount, expense_date"),
      supabase.from("parts").select("id, name, stock_qty, reorder_threshold"),
      supabase.from("purchase_orders").select("id, status"),
      supabase.from("payments").select("amount, paid_at"),
      supabase.from("weekly_insights").select("content, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("customers").select("id, created_at"),
      supabase.from("user_preferences").select("dashboard_layout").eq("user_id", user?.id ?? "").maybeSingle(),
      supabase
        .from("invoices")
        .select("id, vat_rate, discount, customers(id, name), invoice_items(quantity, unit_price), payments(amount), credit_notes(amount)")
        .eq("document_type", "invoice")
        .in("status", ["unpaid", "partial"])
        .returns<OwingRow[]>(),
      supabase
        .from("payments")
        .select("id, amount, method, paid_at, invoices(id, invoice_number, created_at, customers(name))")
        .order("paid_at", { ascending: false })
        .limit(6)
        .returns<RecentPaymentRow[]>(),
      supabase
        .from("job_cards")
        .select("id, status, description, created_at, vehicles(plate_number, emirate, make, model), customers(name)")
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(6)
        .returns<OpenJobRow[]>(),
    ]);

  const realInvoices = (invoices ?? []).filter((i) => i.document_type === "invoice");
  const invoiceTotal = (inv: InvoiceRow) => inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0) * (1 + inv.vat_rate / 100);
  const lineTotal = (inv: InvoiceRow, type: string) =>
    inv.invoice_items.filter((it) => it.item_type === type).reduce((a, it) => a + it.quantity * it.unit_price, 0);

  // Every headline number for a span of UAE days, so the chosen period and the one before compare like for like.
  const metrics = (from: string, to: string) => {
    const revenue = (payments ?? []).filter((p) => inRange(p.paid_at, from, to)).reduce((s, p) => s + Number(p.amount), 0);
    const spent = (expenses ?? []).filter((e) => inRange(e.expense_date, from, to)).reduce((s, e) => s + Number(e.amount), 0);
    const issued = realInvoices.filter((i) => inRange(i.created_at, from, to));
    const aro = issued.length ? issued.reduce((s, i) => s + invoiceTotal(i), 0) / issued.length : 0;
    const completed = (jobs ?? []).filter((j) => j.status === "completed" && inRange(j.completed_at, from, to)).length;
    const newCustomers = (customers ?? []).filter((c) => inRange(c.created_at, from, to)).length;
    return { revenue, spent, net: revenue - spent, issued, aro, completed, newCustomers };
  };
  const now = metrics(range.from, range.to);
  const prev = metrics(range.prevFrom, range.prevTo);
  const spark = (pick: (m: ReturnType<typeof metrics>) => number) => buckets(range.from, range.to).map((b) => pick(metrics(b.from, b.to)));
  const sparkLabels = buckets(range.from, range.to).map((b) => spanLabel(b.from, b.to));

  const laborTotal = now.issued.reduce((s, i) => s + lineTotal(i, "labor"), 0);
  const partsTotal = now.issued.reduce((s, i) => s + lineTotal(i, "part"), 0);
  const serviceTotal = now.issued.reduce((s, i) => s + lineTotal(i, "service"), 0);

  const jobCounts = {
    pending: (jobs ?? []).filter((j) => j.status === "pending").length,
    in_progress: (jobs ?? []).filter((j) => j.status === "in_progress").length,
    completed: (jobs ?? []).filter((j) => j.status === "completed").length,
  };
  const activeJobs = jobCounts.pending + jobCounts.in_progress;
  const utilization = jobs?.length ? Math.round((jobCounts.in_progress / (activeJobs || 1)) * 100) : 0;

  const mechanicStats = new Map<string, { count: number; totalHours: number }>();
  for (const job of jobs ?? []) {
    if (job.status !== "completed" || !job.mechanic_name || !job.completed_at || !inRange(job.completed_at, range.from, range.to)) continue;
    const hours = (new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 3600000;
    const entry = mechanicStats.get(job.mechanic_name) ?? { count: 0, totalHours: 0 };
    entry.count += 1;
    entry.totalHours += hours;
    mechanicStats.set(job.mechanic_name, entry);
  }
  const mechanicRows = [...mechanicStats.entries()].map(([name, st]) => ({ name, completed: st.count, avgHours: st.totalHours / st.count }));

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
  const topCustomersPeriod = topCustomers(now.issued, 5);
  const topCustomersAllTime = topCustomers(realInvoices, 5);

  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [ty, tm] = dayKey(new Date()).split("-").map(Number);
  const monthlyTrend: MonthlyTrendPoint[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(ty, tm - 1 - (5 - i), 1));
    const key = d.toISOString().slice(0, 7);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const m = metrics(`${key}-01`, last);
    return {
      month: key,
      from: `${key}-01`,
      to: last,
      label: `${MONTH_LABELS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      revenue: Math.round(m.revenue),
      expenses: Math.round(m.spent),
      net: Math.round(m.net),
    };
  });

  const owedByCustomer = new Map<string, { name: string; balance: number; invoices: number }>();
  for (const inv of owing ?? []) {
    const bal = invoiceFigures(inv).balance;
    if (bal <= 0.01 || !inv.customers) continue;
    const e = owedByCustomer.get(inv.customers.id) ?? { name: inv.customers.name, balance: 0, invoices: 0 };
    e.balance += bal;
    e.invoices += 1;
    owedByCustomer.set(inv.customers.id, e);
  }
  const owedRows = [...owedByCustomer.entries()].sort((a, b) => b[1].balance - a[1].balance);
  const owedTotal = owedRows.reduce((sum, [, r]) => sum + r.balance, 0);
  const lowParts = (parts ?? []).filter((p) => p.stock_qty <= p.reorder_threshold).sort((a, b) => a.stock_qty - b.stock_qty);

  const heatDays: Record<string, HeatmapDay> = {};
  for (const p of payments ?? []) {
    if (!p.paid_at) continue;
    const k = dayKey(p.paid_at);
    const e = (heatDays[k] ??= { amount: 0, count: 0 });
    e.amount += Number(p.amount);
    e.count += 1;
  }
  const todayKey = dayKey(new Date());

  const mixTotal = laborTotal + partsTotal + serviceTotal;
  const totalJobs = jobCounts.pending + jobCounts.in_progress + jobCounts.completed;
  const vs = range.compareLabel;

  const widgets: DashboardWidget[] = [
    {
      id: "kpis",
      title: "Key numbers",
      description: "Revenue, expenses, profit and average order",
      sizes: [6],
      size: 6,
      node: (
        <StatStrip
          items={[
            { label: "Revenue", value: aed(now.revenue), delta: pctChange(now.revenue, prev.revenue), deltaLabel: vs, spark: spark((m) => m.revenue), sparkLabels },
            { label: "Expenses", value: aed(now.spent), delta: pctChange(now.spent, prev.spent), invertDelta: true, deltaLabel: vs, spark: spark((m) => m.spent), sparkLabels },
            {
              label: "Net profit",
              value: aed(now.net),
              tone: now.net >= 0 ? "positive" : "negative",
              delta: pctChange(now.net, prev.net),
              deltaLabel: vs,
              spark: spark((m) => m.net),
              sparkLabels,
            },
            { label: "Average repair order", value: aed(now.aro), delta: pctChange(now.aro, prev.aro), hint: `${now.issued.length} invoices`, spark: spark((m) => m.aro), sparkLabels },
          ]}
        />
      ),
    },
    {
      id: "tiles",
      title: "Quick stats",
      description: "Jobs done, new customers, low stock, utilisation",
      sizes: [3, 6],
      size: 6,
      node: (
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
          <MiniStat icon="wrench" label="Jobs completed" value={String(now.completed)} hint={`${prev.completed} previous period · ${activeJobs} open now`} />
          <MiniStat icon="user" label="New customers" value={String(now.newCustomers)} hint={`${prev.newCustomers} in previous period`} />
          <MiniStat icon="package" label="Low stock parts" value={String(lowStockCount)} hint="At or below reorder level" warn={lowStockCount > 0} />
          <MiniStat icon="trending" label="Shop utilisation" value={`${utilization}%`} hint={`${pendingPOs} open purchase orders`} />
        </div>
      ),
    },
    {
      id: "heatmap",
      title: "Year at a glance",
      description: "Takings every day for 12 months — click a day for its cash flow",
      sizes: [4, 6],
      size: 6,
      node: (
        <Panel title="Year at a glance" action={<span className="text-xs text-zinc-500">Payments received per day</span>} className="h-full">
          <div className="p-4">
            <RevenueHeatmap days={heatDays} today={todayKey} />
          </div>
        </Panel>
      ),
    },
    {
      id: "trend",
      title: "Revenue vs expenses",
      description: "Six-month chart — click a month for details",
      sizes: [3, 4, 6],
      size: 4,
      node: (
        <Panel title="Revenue vs expenses" action={<span className="text-xs text-zinc-500">Last 6 months</span>} className="h-full">
          <div className="p-4">
            <MonthlyTrendChart data={monthlyTrend} />
          </div>
        </Panel>
      ),
    },
    {
      id: "mix",
      title: "Revenue mix",
      description: "Labour, parts and services, plus the job pipeline",
      sizes: [2, 3],
      size: 2,
      node: (
        <Panel title="Revenue mix" action={<span className="text-xs text-zinc-500">Invoices in period</span>} className="h-full">
          <div className="space-y-4 p-4">
            <p className="font-display text-[28px] font-semibold leading-none tabular sm:text-[32px] text-zinc-900">{aed(mixTotal)}</p>
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
              <p className="mb-2 text-xs font-medium text-zinc-500">Job pipeline now · {totalJobs} total</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <PipelineCount label="Pending" value={jobCounts.pending} dot="bg-zinc-400" />
                <PipelineCount label="In progress" value={jobCounts.in_progress} dot="bg-amber-500" />
                <PipelineCount label="Completed" value={jobCounts.completed} dot="bg-emerald-500" />
              </div>
            </div>
          </div>
        </Panel>
      ),
    },
    {
      id: "techs",
      title: "Technician performance",
      description: "Jobs finished and average time per mechanic",
      sizes: [2, 3, 6],
      size: 2,
      node: (
        <Panel title="Technician performance" action={<span className="text-xs text-zinc-500">In period</span>} className="h-full">
          {mechanicRows.length === 0 ? (
            <PanelEmpty message="No completed jobs with a mechanic in this period." />
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
      ),
    },
    {
      id: "top-period",
      title: "Top customers · this period",
      description: "Biggest spenders in the chosen dates",
      sizes: [2, 3],
      size: 2,
      node: <TopCustomersPanel title="Top customers · this period" rows={topCustomersPeriod} empty="No invoices in this period." />,
    },
    {
      id: "top-all",
      title: "Top customers · all time",
      description: "Your most valuable customers ever",
      sizes: [2, 3],
      size: 2,
      node: <TopCustomersPanel title="Top customers · all time" rows={topCustomersAllTime} empty="No invoices yet." />,
    },
    {
      id: "insights",
      title: "Weekly summary",
      description: "AI-written overview of the week",
      sizes: [3, 4, 6],
      size: 6,
      node: (
        <Panel title="Weekly summary" className="h-full" action={<GenerateInsightsButton action={generateAndSaveWeeklyInsights} />}>
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
      ),
    },
    {
      id: "owed",
      title: "Money owed to you",
      description: "Customers with unpaid balances, biggest first",
      sizes: [2, 3, 6],
      size: 3,
      hidden: true,
      node: (
        <Panel title="Money owed to you" count={owedRows.length} className="h-full" action={<Link href="/reports/outstanding-dues" className="font-medium text-zinc-500 hover:text-zinc-900">View all</Link>}>
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="label-caps">Total outstanding</p>
            <p className="mt-1 font-display text-[28px] font-semibold leading-none tabular sm:text-[32px] text-red-700">{aed(owedTotal)}</p>
          </div>
          {owedRows.length === 0 ? (
            <PanelEmpty message="Nobody owes you anything right now." />
          ) : (
            <ol className="divide-y divide-zinc-100">
              {owedRows.slice(0, 5).map(([id, r]) => (
                <li key={id}>
                  <Link href={`/customers/${id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-900">{r.name}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {r.invoices} invoice{r.invoices > 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium text-red-700 tabular">{aed(r.balance)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      ),
    },
    {
      id: "lowstock",
      title: "Low stock",
      description: "Parts at or below their reorder level",
      sizes: [2, 3],
      size: 3,
      hidden: true,
      node: (
        <Panel title="Low stock" count={lowParts.length} className="h-full" action={<Link href="/inventory" className="font-medium text-zinc-500 hover:text-zinc-900">Parts stock</Link>}>
          {lowParts.length === 0 ? (
            <PanelEmpty message="Everything is above its reorder level." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {lowParts.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/inventory/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50">
                    <span className="min-w-0 truncate font-medium text-zinc-900">{p.name}</span>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular ring-1 ring-inset ${
                        p.stock_qty <= 0 ? "bg-red-50 text-red-700 ring-red-200" : "bg-amber-50 text-amber-800 ring-amber-200"
                      }`}
                    >
                      {p.stock_qty} left · reorder at {p.reorder_threshold}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ),
    },
    {
      id: "payments",
      title: "Recent payments",
      description: "The latest money received",
      sizes: [2, 3],
      size: 3,
      hidden: true,
      node: (
        <Panel title="Recent payments" className="h-full" action={<Link href="/reports/daily-cashflow" className="font-medium text-zinc-500 hover:text-zinc-900">Cash flow</Link>}>
          {(recentPayments ?? []).length === 0 ? (
            <PanelEmpty message="No payments yet." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(recentPayments ?? []).map((pay) => (
                <li key={pay.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-zinc-900">{pay.invoices?.customers?.name ?? "Payment"}</span>
                    <span className="block text-[11px] text-zinc-500">
                      {formatDateTime(pay.paid_at)} · <span className="capitalize">{pay.method.replace("_", " ")}</span>
                      {pay.invoices && <span className="font-semibold"> · {formatInvoiceNumber(pay.invoices.invoice_number, pay.invoices.created_at)}</span>}
                    </span>
                  </span>
                  <span className={`shrink-0 font-medium tabular ${Number(pay.amount) < 0 ? "text-red-700" : "text-emerald-700"}`}>{aed(Number(pay.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ),
    },
    {
      id: "openjobs",
      title: "Open jobs",
      description: "Cars in the workshop right now",
      sizes: [2, 3, 6],
      size: 3,
      hidden: true,
      node: (
        <Panel title="Open jobs" count={activeJobs} className="h-full" action={<Link href="/jobs" className="font-medium text-zinc-500 hover:text-zinc-900">Job board</Link>}>
          {(openJobs ?? []).length === 0 ? (
            <PanelEmpty message="No cars in the workshop." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(openJobs ?? []).map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50">
                    {j.vehicles && <PlateBadge plateNumber={j.vehicles.plate_number} emirate={j.vehicles.emirate} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-900">{[j.vehicles?.make, j.vehicles?.model].filter(Boolean).join(" ") || "Vehicle"}</span>
                      <span className="block truncate text-[11px] text-zinc-500">{j.customers?.name}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                        j.status === "in_progress" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-zinc-100 text-zinc-700 ring-zinc-200"
                      }`}
                    >
                      {j.status === "in_progress" ? "In progress" : "Pending"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ),
    },
  ];
  const specs = widgets.map((w) => ({ id: w.id, title: w.title, description: w.description, sizes: w.sizes, size: w.size, hidden: w.hidden }));

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description={`Business performance · ${range.label}`}
        action={
          <DateRangePicker range={range} basePath="/dashboard">
            <a href={`/reports/monthly-summary/export?month=${range.to.slice(0, 7)}`}>
              <SecondaryButton type="button" icon="download">
                Export
              </SecondaryButton>
            </a>
            <CustomizeDashboardButton />
          </DateRangePicker>
        }
      />

      <DashboardGrid widgets={widgets} initial={resolveLayout(specs, prefs?.dashboard_layout ?? null)} defaults={defaultLayout(specs)} save={saveDashboardLayout} />
    </div>
  );
}

function aed(amount: number) {
  return `AED ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
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
        <p className="line-clamp-2 label-caps sm:truncate">{label}</p>
        <p className={`mt-0.5 font-display text-[24px] font-semibold leading-none tabular ${warn ? "text-amber-700" : "text-zinc-900"}`}>{value}</p>
        <p className="line-clamp-2 text-[11px] text-zinc-400 sm:truncate">{hint}</p>
      </div>
    </Card>
  );
}

function PipelineCount({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-2">
      <p className="font-display text-[20px] font-semibold leading-tight text-zinc-900 tabular">{value}</p>
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
    <Panel title={title} className="h-full">
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
