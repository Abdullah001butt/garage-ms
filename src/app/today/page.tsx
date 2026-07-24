import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { WhatsAppButton } from "@/components/WhatsAppButton";

type JobRow = {
  id: string;
  description: string;
  status: "pending" | "in_progress";
  created_at: string;
  vehicles: { plate_number: string; make: string | null; model: string | null } | null;
  customers: { name: string; phone: string } | null;
};

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  notes: string | null;
  customers: { name: string } | null;
  vehicles: { plate_number: string } | null;
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

function hoursAgo(dateStr: string) {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 3600000);
}

export default async function TodayPage() {
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [{ data: jobs }, { data: appointments }, { data: invoices }, { data: parts }] = await Promise.all([
    supabase
      .from("job_cards")
      .select("id, description, status, created_at, vehicles(plate_number, make, model), customers(name, phone)")
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: true })
      .returns<JobRow[]>(),
    supabase
      .from("appointments")
      .select("id, scheduled_at, notes, customers(name), vehicles(plate_number)")
      .eq("status", "scheduled")
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
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

  const lowStockParts = (parts ?? []).filter((p) => p.stock_qty <= p.reorder_threshold);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title="Today" description="Everything that needs attention right now, in one place." />

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Active Jobs {jobs && jobs.length > 0 && `(${jobs.length})`}
          </h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {jobs?.map((job) => (
                <li key={job.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/jobs/${job.id}`} className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {job.vehicles?.plate_number} — {job.customers?.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{job.description}</p>
                    </Link>
                    <Badge color={job.status === "in_progress" ? "amber" : "gray"}>
                      {hoursAgo(job.created_at)}h
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
            {jobs?.length === 0 && <EmptyState message="No active jobs right now." />}
          </Card>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Today&apos;s Appointments {appointments && appointments.length > 0 && `(${appointments.length})`}
          </h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {appointments?.map((apt) => (
                <li key={apt.id} className="px-4 py-3">
                  <p className="font-medium text-slate-900">
                    {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} —{" "}
                    {apt.customers?.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {apt.vehicles?.plate_number ?? "No vehicle"}
                    {apt.notes ? ` · ${apt.notes}` : ""}
                  </p>
                </li>
              ))}
            </ul>
            {appointments?.length === 0 && <EmptyState message="No appointments today." />}
          </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Outstanding Balances {overdueInvoices.length > 0 && `(${overdueInvoices.length})`}
          </h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {overdueInvoices.map((inv) => (
                <li key={inv.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <Link href={`/invoices/${inv.id}`} className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {inv.job_cards?.vehicles?.plate_number ?? inv.customers?.name}
                    </p>
                    <p className="text-xs text-red-600 font-medium">AED {inv.balance.toFixed(2)} due</p>
                  </Link>
                  {inv.customers?.phone && (
                    <WhatsAppButton
                      phone={inv.customers.phone}
                      message={`Hi ${inv.customers.name.split(" ")[0]}, a friendly reminder that AED ${inv.balance.toFixed(
                        2
                      )} is still due for your service at Al Bahir Garage. — Al Bahir Garage`}
                      label="Remind"
                    />
                  )}
                </li>
              ))}
            </ul>
            {overdueInvoices.length === 0 && <EmptyState message="No outstanding balances." />}
          </Card>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Low Stock {lowStockParts.length > 0 && `(${lowStockParts.length})`}
          </h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {lowStockParts.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <Badge color="red">{p.stock_qty} left</Badge>
                </li>
              ))}
            </ul>
            {lowStockParts.length === 0 && <EmptyState message="All parts sufficiently stocked." />}
          </Card>
        </div>
      </div>
    </div>
  );
}
