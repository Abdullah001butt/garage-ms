import { formatDate, formatTime, formatWeekdayDate, uaeDayRange } from "@/lib/format";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, Panel, PanelEmpty, PrimaryButton, SecondaryButton } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { PlateBadge } from "@/components/PlateBadge";
import { getServiceDueVehicles } from "@/lib/service-due";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { supplierBalances } from "@/lib/suppliers";
import { SetupGuide, type SetupStep } from "@/components/SetupGuide";

type JobRow = {
  id: string;
  description: string;
  status: "pending" | "in_progress";
  created_at: string;
  vehicles: { plate_number: string; emirate: string; make: string | null; model: string | null } | null;
  customers: { name: string; phone: string } | null;
};

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  notes: string | null;
  customers: { name: string } | null;
  vehicles: { plate_number: string; emirate: string } | null;
};

type InvoiceRow = {
  id: string;
  discount: number;
  customers: { name: string; phone: string } | null;
  job_cards: { vehicles: { plate_number: string } | null } | null;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { amount: number }[];
};

type PartRow = {
  id: string;
  name: string;
  stock_qty: number;
  reorder_threshold: number;
};

type CompletedJobRow = {
  id: string;
  completed_at: string | null;
  vehicles: { plate_number: string } | null;
  customers: { name: string } | null;
};

function hoursAgo(dateStr: string) {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 3600000);
}

function formatAge(hours: number) {
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function formatAed(amount: number) {
  return `AED ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function KpiTile({
  label,
  value,
  hint,
  icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  icon: IconName;
  href: string;
  tone?: "default" | "warn";
}) {
  return (
    <Link href={href} className="group">
      <Card className="flex h-full items-start justify-between gap-3 p-4 transition-colors group-hover:border-zinc-300">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-zinc-500">{label}</p>
          <p className={`mt-1.5 text-xl font-semibold tracking-tight whitespace-nowrap tabular sm:text-2xl ${tone === "warn" ? "text-red-700" : "text-zinc-900"}`}>
            {value}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500 sm:truncate">{hint}</p>
        </div>
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500 sm:flex">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </Card>
    </Link>
  );
}

const viewAll = (href: string, label = "View all") => (
  <Link href={href} className="inline-flex items-center gap-0.5 font-medium text-zinc-500 hover:text-zinc-900">
    {label}
    <Icon name="chevron-right" className="h-3.5 w-3.5" />
  </Link>
);

export default async function TodayPage() {
  const supabase = await createClient();
  const { start: todayStart, end: todayEnd } = uaeDayRange();

  const [{ data: jobs }, { data: appointments }, { data: invoices }, { data: parts }, { data: completedJobs }] = await Promise.all([
    supabase
      .from("job_cards")
      .select("id, description, status, created_at, vehicles(plate_number, emirate, make, model), customers(name, phone)")
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: true })
      .returns<JobRow[]>(),
    supabase
      .from("appointments")
      .select("id, scheduled_at, notes, customers(name), vehicles(plate_number, emirate)")
      .eq("status", "scheduled")
      .gte("scheduled_at", todayStart)
      .lte("scheduled_at", todayEnd)
      .order("scheduled_at", { ascending: true })
      .returns<AppointmentRow[]>(),
    supabase
      .from("invoices")
      .select(
        "id, discount, customers(name, phone), job_cards(vehicles(plate_number)), invoice_items(quantity, unit_price), payments(amount)"
      )
      .eq("document_type", "invoice")
      .in("status", ["unpaid", "partial"])
      .returns<InvoiceRow[]>(),
    supabase.from("parts").select("id, name, stock_qty, reorder_threshold").returns<PartRow[]>(),
    supabase
      .from("job_cards")
      .select("id, completed_at, vehicles(plate_number), customers(name)")
      .eq("status", "completed")
      .order("completed_at", { ascending: true })
      .returns<CompletedJobRow[]>(),
  ]);

  const overdueInvoices = (invoices ?? [])
    .map((inv) => {
      const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const total = subtotal - inv.discount;
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      return { ...inv, balance: Math.max(total - paid, 0) };
    })
    .filter((inv) => inv.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const outstandingTotal = overdueInvoices.reduce((s, inv) => s + inv.balance, 0);

  const lowStockParts = (parts ?? []).filter((p) => p.stock_qty <= p.reorder_threshold);
  const serviceDue = await getServiceDueVehicles();
  const activeJobs = jobs ?? [];
  const inProgressCount = activeJobs.filter((j) => j.status === "in_progress").length;
  const staleJobs = activeJobs.filter((job) => hoursAgo(job.created_at) >= 48);

  const { data: invoicedJobIds } = await supabase
    .from("invoices")
    .select("job_card_id")
    .not("job_card_id", "is", null);
  const invoicedSet = new Set((invoicedJobIds ?? []).map((i) => i.job_card_id));
  const unbilledJobs = (completedJobs ?? []).filter((job) => !invoicedSet.has(job.id));

  const attention = [
    ...unbilledJobs.map((job) => ({
      key: `unbilled-${job.id}`,
      href: `/jobs/${job.id}`,
      tone: "amber" as const,
      icon: "receipt" as IconName,
      title: `${job.vehicles?.plate_number ?? "Vehicle"} · ${job.customers?.name ?? "Customer"}`,
      detail: "Job completed but not invoiced yet",
      cta: "Create invoice",
    })),
    ...staleJobs.map((job) => ({
      key: `stale-${job.id}`,
      href: `/jobs/${job.id}`,
      tone: "red" as const,
      icon: "clock" as IconName,
      title: `${job.vehicles?.plate_number ?? "Vehicle"} · ${job.customers?.name ?? "Customer"}`,
      detail: `In the bay for ${formatAge(hoursAgo(job.created_at))}`,
      cta: "Open job",
    })),
  ];

  const dateLabel = formatWeekdayDate(new Date());

  // Owner-only extras: what we owe suppliers, and the "Get set up" checklist.
  const { profile } = await getCurrentUserAndProfile();
  let supplierOwed = 0;
  let suppliersOwing = 0;
  let setupSteps: SetupStep[] = [];
  if (profile?.role === "owner") {
    const head = { count: "exact" as const, head: true };
    const [{ data: supplierEntries }, { data: settings }, staffPaid, partsCount, supplierCount, customerCount, jobCount, invoiceCount] = await Promise.all([
      supabase.from("supplier_entries").select("supplier_id, kind, amount"),
      supabase.from("shop_settings").select("trn, phone, google_review_link").limit(1).maybeSingle(),
      supabase.from("profiles").select("id", head).gt("monthly_salary", 0),
      supabase.from("parts").select("id", head),
      supabase.from("suppliers").select("id", head),
      supabase.from("customers").select("id", head).neq("phone", "-"),
      supabase.from("job_cards").select("id", head),
      supabase.from("invoices").select("id", head).eq("document_type", "invoice"),
    ]);
    const balances = [...supplierBalances(supplierEntries ?? []).values()].filter((b) => b > 0.01);
    supplierOwed = balances.reduce((s, b) => s + b, 0);
    suppliersOwing = balances.length;
    setupSteps = [
      { title: "Shop details & TRN", detail: "Printed on every invoice", href: "/settings", done: Boolean(settings?.trn && settings?.phone) },
      { title: "Staff & salaries", detail: "For attendance and payslips", href: "/staff", done: (staffPaid.count ?? 0) > 0 },
      { title: "Parts in stock", detail: "So invoices pick prices", href: "/inventory", done: (partsCount.count ?? 0) > 0 },
      { title: "Suppliers", detail: "Track what you owe", href: "/suppliers?new=1", done: (supplierCount.count ?? 0) > 0 },
      { title: "First customer", detail: "With their vehicle", href: "/customers/new", done: (customerCount.count ?? 0) > 0 },
      { title: "First job card", detail: "When a car comes in", href: "/jobs/new", done: (jobCount.count ?? 0) > 0 },
      { title: "First invoice", detail: "From a finished job", href: "/jobs", done: (invoiceCount.count ?? 0) > 0 },
      { title: "Google reviews", detail: "Link happy customers", href: "/settings", done: Boolean(settings?.google_review_link) },
    ];
  }

  return (
    <div className="page">
      <PageHeader
        title="Today"
        description={dateLabel}
        action={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto [&_button]:w-full">
            <Link href="/jobs/new" className="col-span-2 sm:order-last">
              <PrimaryButton type="button">+ New Job</PrimaryButton>
            </Link>
            <Link href="/appointments?new=1">
              <SecondaryButton type="button" icon="calendar">
                Appointment
              </SecondaryButton>
            </Link>
            <Link href="/estimates/new">
              <SecondaryButton type="button" icon="file">
                Estimate
              </SecondaryButton>
            </Link>
          </div>
        }
      />

      {setupSteps.length > 0 && <SetupGuide steps={setupSteps} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Active jobs"
          value={String(activeJobs.length)}
          hint={`${inProgressCount} in progress · ${activeJobs.length - inProgressCount} pending`}
          icon="wrench"
          href="/jobs"
        />
        <KpiTile
          label="Appointments today"
          value={String(appointments?.length ?? 0)}
          hint={appointments?.[0] ? `Next at ${formatTime(appointments[0].scheduled_at)}` : "Nothing booked"}
          icon="calendar"
          href="/appointments"
        />
        <KpiTile
          label="Outstanding"
          value={formatAed(outstandingTotal)}
          hint={`${overdueInvoices.length} unpaid invoice${overdueInvoices.length === 1 ? "" : "s"}`}
          icon="wallet"
          href="/reports/outstanding-dues"
          tone={outstandingTotal > 0 ? "warn" : "default"}
        />
        <KpiTile
          label="Low stock"
          value={String(lowStockParts.length)}
          hint={lowStockParts.length ? "Parts at reorder level" : "All parts stocked"}
          icon="package"
          href="/inventory"
          tone={lowStockParts.length ? "warn" : "default"}
        />
      </div>

      {attention.length > 0 && (
        <Panel title="Needs attention" count={attention.length} className="mt-6">
          <ul className="divide-y divide-zinc-100">
            {attention.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="group flex items-center gap-3 px-4 py-3 hover:bg-zinc-50/60">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      item.tone === "red" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    <Icon name={item.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{item.title}</p>
                    <p className="truncate text-xs text-zinc-500">{item.detail}</p>
                  </div>
                  <span className="hidden shrink-0 items-center gap-0.5 text-[13px] font-medium text-zinc-500 group-hover:text-zinc-900 sm:inline-flex">
                    {item.cta}
                    <Icon name="chevron-right" className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Panel title="Active jobs" count={activeJobs.length} action={viewAll("/jobs")} className="lg:col-span-3">
          {activeJobs.length === 0 ? (
            <PanelEmpty message="No vehicles in the workshop right now." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {activeJobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50/60">
                    {job.vehicles && <PlateBadge plateNumber={job.vehicles.plate_number} emirate={job.vehicles.emirate} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ") || "Vehicle"}
                        <span className="font-normal text-zinc-500"> · {job.customers?.name}</span>
                      </p>
                      <p className="truncate text-xs text-zinc-500">{job.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge color={job.status === "in_progress" ? "amber" : "slate"} dot>
                        {job.status === "in_progress" ? "In progress" : "Pending"}
                      </Badge>
                      <span className="text-[11px] text-zinc-400 tabular">{formatAge(hoursAgo(job.created_at))}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Today's appointments" count={appointments?.length ?? 0} action={viewAll("/appointments")} className="lg:col-span-2">
          {!appointments?.length ? (
            <PanelEmpty message="No appointments booked for today." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {appointments.map((apt) => (
                <li key={apt.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-sm font-semibold text-zinc-900 tabular">
                    {formatTime(apt.scheduled_at)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{apt.customers?.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {apt.vehicles?.plate_number ?? "No vehicle"}
                      {apt.notes ? ` · ${apt.notes}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Outstanding balances" count={overdueInvoices.length} action={viewAll("/reports/outstanding-dues")}>
          {overdueInvoices.length === 0 ? (
            <PanelEmpty message="Every invoice is settled." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {overdueInvoices.slice(0, 6).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <Link href={`/invoices/${inv.id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 hover:underline">{inv.customers?.name ?? "Customer"}</p>
                    <p className="text-xs font-medium text-red-700 tabular">{formatAed(inv.balance)}</p>
                  </Link>
                  {inv.customers?.phone && (
                    <WhatsAppButton
                      phone={inv.customers.phone}
                      message={`Hi ${inv.customers.name.split(" ")[0]}, a friendly reminder that AED ${inv.balance.toFixed(
                        2
                      )} is still due for your service at Al Bahir Garage. — Al Bahir Garage`}
                      label="Remind"
                      size="sm"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {supplierOwed > 0 && (
            <Link href="/suppliers" className="flex items-center gap-3 border-t border-zinc-200 bg-zinc-50/60 px-4 py-2.5 hover:bg-zinc-50">
              <Icon name="package" className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-zinc-900">We owe suppliers</span>
                <span className="block text-xs text-zinc-500">
                  {suppliersOwing} supplier{suppliersOwing === 1 ? "" : "s"} unpaid
                </span>
              </span>
              <span className="text-sm font-semibold tabular text-red-700">{formatAed(supplierOwed)}</span>
              <Icon name="chevron-right" className="h-4 w-4 text-zinc-300" />
            </Link>
          )}
        </Panel>

        <Panel title="Low stock" count={lowStockParts.length} action={viewAll("/inventory")}>
          {lowStockParts.length === 0 ? (
            <PanelEmpty message="All parts are sufficiently stocked." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {lowStockParts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <p className="truncate text-sm text-zinc-900">{p.name}</p>
                  <Badge color="red">{p.stock_qty} left</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Service due" count={serviceDue.length} action={viewAll("/service-reminders")}>
          {serviceDue.length === 0 ? (
            <PanelEmpty message="No vehicles due for service soon." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {serviceDue.slice(0, 6).map((v) => (
                <li key={v.vehicleId} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {v.plateNumber} <span className="font-normal text-zinc-500">· {v.customerName}</span>
                    </p>
                    <p className="text-xs text-zinc-500">Last service {formatDate(v.lastServiceAt)}</p>
                  </div>
                  <Badge color={v.status === "overdue" ? "red" : "amber"}>
                    {v.status === "overdue" ? "Overdue" : `Due ${formatDate(v.dueAt)}`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
