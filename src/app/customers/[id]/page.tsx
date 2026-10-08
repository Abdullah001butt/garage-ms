import { Morph } from "@/components/Morph";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Vehicle, CustomerBalanceAdjustment, AuditLog } from "@/lib/types";
import {
  addVehicle,
  updateVehicleServiceInterval,
  updateCustomer,
  deleteCustomer,
  updateVehicle,
  deleteVehicle,
  addBalanceAdjustment,
  deleteBalanceAdjustment,
  addEmployee,
  unlinkEmployee,
  setVehicleCompanyPays,
} from "@/app/customers/actions";
import { Card, Panel, PanelEmpty, Field, Badge, SecondaryButton, PrimaryButton, theadClass, thClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SlideOver } from "@/components/SlideOver";
import { RowMenu, RowMenuAction, RowMenuDelete, RowMenuLink, RowMenuOpenPanel, RowMenuSeparator } from "@/components/RowMenu";
import { TabLinks } from "@/components/Tabs";
import { ActivityTimeline, auditVisual, type ActivityEvent } from "@/components/ActivityTimeline";
import { getActiveWarrantiesForVehicles } from "@/lib/warranty";
import { PlateBadge } from "@/components/PlateBadge";
import { CustomerFields } from "@/components/CustomerFields";
import { VehicleFields } from "@/components/VehicleFields";
import { formatDate } from "@/lib/format";
import { formatInvoiceNumber } from "@/lib/invoice-number";
import { auditLabel } from "@/lib/audit-labels";

type CustomerInvoiceRow = {
  id: string;
  document_type: "invoice" | "estimate";
  status: "unpaid" | "partial" | "paid";
  invoice_number: number | null;
  created_at: string;
  discount: number;
  vat_rate: number;
  invoice_items: { quantity: number; unit_price: number }[];
  payments: { id: string; amount: number; paid_at: string; method: string }[];
};

type CustomerJobRow = {
  id: string;
  description: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  vehicle_id: string;
};

const TABS = ["overview", "vehicles", "employees", "invoices", "activity"] as const;

type EmployeeRow = Pick<Customer, "id" | "name" | "phone" | "job_title"> & { vehicles: Vehicle[] };
type Tab = (typeof TABS)[number];

const STATUS_COLOR = { paid: "green", partial: "amber", unpaid: "red" } as const;

function registrationBadge(expiryDate: string | null) {
  if (!expiryDate) return null;
  const daysLeft = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return <Badge color="red">Registration expired</Badge>;
  if (daysLeft <= 30) return <Badge color="amber">Registration due {formatDate(expiryDate)}</Badge>;
  return null;
}

function money(n: number) {
  return `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "overview";
  const supabase = await createClient();

  const [{ data: customer }, { data: vehicles }, { data: invoices }, { data: adjustments }, { data: allVehicles }, { data: jobs }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single<Customer>(),
      supabase.from("vehicles").select("*").eq("customer_id", id).order("created_at", { ascending: false }).returns<Vehicle[]>(),
      supabase
        .from("invoices")
        .select("id, document_type, status, invoice_number, created_at, discount, vat_rate, invoice_items(quantity, unit_price), payments(id, amount, paid_at, method)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .returns<CustomerInvoiceRow[]>(),
      supabase
        .from("customer_balance_adjustments")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .returns<CustomerBalanceAdjustment[]>(),
      supabase.from("vehicles").select("make, model"),
      supabase
        .from("job_cards")
        .select("id, description, status, created_at, completed_at, vehicle_id")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .returns<CustomerJobRow[]>(),
    ]);

  if (!customer) notFound();

  const [{ data: companies }, { data: parentCompany }, { data: employeeRows }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("customer_type", "company").order("name").returns<{ id: string; name: string }[]>(),
    customer.parent_customer_id
      ? supabase.from("customers").select("id, name").eq("id", customer.parent_customer_id).maybeSingle<{ id: string; name: string }>()
      : Promise.resolve({ data: null }),
    customer.customer_type === "company"
      ? supabase.from("customers").select("id, name, phone, job_title, vehicles(*)").eq("parent_customer_id", id).order("name").returns<EmployeeRow[]>()
      : Promise.resolve({ data: [] as EmployeeRow[] }),
  ]);
  const employees = employeeRows ?? [];
  const employeeCars = employees.reduce((n, e) => n + e.vehicles.length, 0);
  const companyPaidCars = employees.reduce((n, e) => n + e.vehicles.filter((v) => v.company_pays).length, 0);

  const vehicleList = vehicles ?? [];
  const allInvoices = invoices ?? [];
  const realInvoices = allInvoices.filter((i) => i.document_type === "invoice");
  const totalOf = (inv: CustomerInvoiceRow) => {
    const subtotal = inv.invoice_items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    return subtotal + subtotal * (inv.vat_rate / 100) - inv.discount;
  };
  const paidOf = (inv: CustomerInvoiceRow) => inv.payments.reduce((s, p) => s + Number(p.amount), 0);

  const invoiceBalance = realInvoices
    .filter((i) => i.status === "unpaid" || i.status === "partial")
    .reduce((sum, inv) => sum + Math.max(totalOf(inv) - paidOf(inv), 0), 0);
  const adjustmentBalance = (adjustments ?? []).reduce((s, a) => s + Number(a.amount), 0);
  const accountBalance = invoiceBalance + adjustmentBalance;
  const lifetimeSpend = realInvoices.reduce((s, i) => s + totalOf(i), 0);

  const uniqueMakes = [...new Set((allVehicles ?? []).map((v) => v.make).filter(Boolean))];
  const uniqueModels = [...new Set((allVehicles ?? []).map((v) => v.model).filter(Boolean))];
  const warrantyMap = await getActiveWarrantiesForVehicles(vehicleList.map((v) => v.id));

  const isCompany = customer.customer_type === "company";
  const base = `/customers/${id}`;
  const tabHref = (key: Tab) => (key === "overview" ? base : `${base}?tab=${key}`);

  // Activity: milestones from the records themselves + "who changed what" from the audit log.
  let activity: ActivityEvent[] = [];
  if (tab === "activity") {
    const entityIds = [id, ...vehicleList.map((v) => v.id), ...allInvoices.map((i) => i.id), ...(jobs ?? []).map((j) => j.id)];
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .in("entity_id", entityIds)
      .order("created_at", { ascending: false })
      .limit(60)
      .returns<AuditLog[]>();
    const plateOf = new Map(vehicleList.map((v) => [v.id, v.plate_number]));
    activity = [
      { id: `c-${id}`, at: customer.created_at, title: "Customer added", icon: "user", tone: "green" },
      ...vehicleList.map((v): ActivityEvent => ({
        id: `v-${v.id}`,
        at: v.created_at,
        title: `Vehicle ${v.plate_number} added`,
        detail: [v.make, v.model, v.year].filter(Boolean).join(" ") || null,
        icon: "car",
        tone: "slate",
      })),
      ...(jobs ?? []).flatMap((j): ActivityEvent[] => [
        { id: `j-${j.id}`, at: j.created_at, title: `Job opened · ${plateOf.get(j.vehicle_id) ?? ""}`, detail: j.description, icon: "wrench", tone: "blue" },
        ...(j.completed_at
          ? [{ id: `jc-${j.id}`, at: j.completed_at, title: `Job completed · ${plateOf.get(j.vehicle_id) ?? ""}`, detail: j.description, icon: "check-circle" as const, tone: "green" as const }]
          : []),
      ]),
      ...allInvoices.map((inv): ActivityEvent => ({
        id: `i-${inv.id}`,
        at: inv.created_at,
        title: inv.document_type === "estimate" ? "Estimate created" : `Invoice ${formatInvoiceNumber(inv.invoice_number, inv.created_at) ?? ""} issued`,
        detail: money(totalOf(inv)),
        icon: "receipt",
        tone: "blue",
      })),
      ...allInvoices.flatMap((inv) =>
        inv.payments.map((p): ActivityEvent => ({
          id: `p-${p.id}`,
          at: p.paid_at,
          title: `Payment received · ${money(Number(p.amount))}`,
          detail: p.method.charAt(0).toUpperCase() + p.method.slice(1).replace(/_/g, " "),
          icon: "wallet",
          tone: "green",
        }))
      ),
      ...(logs ?? [])
        .filter((l) => !["invoice.create", "estimate.create", "payment.record"].includes(l.action))
        .map((l): ActivityEvent => ({
          id: `a-${l.id}`,
          at: l.created_at,
          title: auditLabel(l.action),
          actor: l.actor_name,
          ...auditVisual(l.action),
        })),
    ];
  }

  const details: [string, string | null][] = [
    ["Type", isCompany ? "Company" : "Individual"],
    ["Mobile", customer.phone],
    ["Landline", customer.landline],
    ["Email", customer.email],
    ["Address", customer.address],
    ["City", customer.city],
    ["TRN / VAT", customer.trn_number],
    ["Representative", customer.representative],
    ["Reference", customer.reference_name],
    ["Customer since", formatDate(customer.created_at)],
  ];

  return (
    <div className="page">
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to customers
      </Link>

      <datalist id="vehicle-makes">
        {uniqueMakes.map((m) => (
          <option key={m} value={m as string} />
        ))}
      </datalist>
      <datalist id="vehicle-models">
        {uniqueModels.map((m) => (
          <option key={m} value={m as string} />
        ))}
      </datalist>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <Morph name={`cust-icon-${customer.id}`}>
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                isCompany ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              <Icon name={isCompany ? "building" : "user"} className="h-5 w-5" />
            </span>
          </Morph>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Morph name={`cust-${customer.id}`}>
                <h1 className="font-display text-[28px] font-bold uppercase leading-none tracking-[0.01em] text-zinc-900 sm:text-[32px]">{customer.name}</h1>
              </Morph>
              <Badge color={isCompany ? "indigo" : "slate"}>{isCompany ? "Company" : parentCompany ? "Employee" : "Individual"}</Badge>
              {isCompany && employees.length > 0 && <Badge color="slate">{employees.length} employees</Badge>}
            </div>
            {parentCompany && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-600">
                <Icon name="building" className="h-3.5 w-3.5 text-zinc-400" />
                {customer.job_title ? `${customer.job_title} at ` : "Employee of "}
                <Link href={`/customers/${parentCompany.id}`} className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600">
                  {parentCompany.name}
                </Link>
              </p>
            )}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Icon name="phone" className="h-3.5 w-3.5" />
                {customer.phone}
              </span>
              {customer.email && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="mail" className="h-3.5 w-3.5" />
                  {customer.email}
                </span>
              )}
              {customer.city && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="map-pin" className="h-3.5 w-3.5" />
                  {customer.city}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SlideOver
            id="edit-customer"
            title="Edit customer"
            description="Contact and billing details."
            triggerLabel="Edit"
            triggerIcon="pencil"
            variant="secondary"
          >
            <form action={updateCustomer.bind(null, id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CustomerFields customer={customer} lockType companies={companies ?? []} />
              <div className="col-span-full">
                <PrimaryButton type="submit" className="w-full">
                  Save changes
                </PrimaryButton>
              </div>
            </form>
          </SlideOver>
          <Link href={`${base}/statement`}>
            <SecondaryButton type="button" icon="file">
              Statement
            </SecondaryButton>
          </Link>
          <div className="rounded-md border border-zinc-300 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
            <RowMenu label="More actions">
              {isCompany && (
                <RowMenuLink href={`${base}/fleet`} icon="car">
                  Fleet overview
                </RowMenuLink>
              )}
              <RowMenuLink href={`/jobs/new`} icon="wrench">
                New job card
              </RowMenuLink>
              <RowMenuSeparator />
              <RowMenuDelete
                action={deleteCustomer.bind(null, id)}
                confirmMessage={`Delete customer "${customer.name}" and all their records? This can't be undone.`}
                successMessage="Customer deleted."
                label="Delete customer"
                redirectTo="/customers"
              />
            </RowMenu>
          </div>
        </div>
      </div>

      <TabLinks
        active={tab}
        tabs={[
          { key: "overview", label: "Overview", href: tabHref("overview") },
          { key: "vehicles", label: "Vehicles", href: tabHref("vehicles"), count: vehicleList.length },
          ...(isCompany ? [{ key: "employees", label: "Employees", href: tabHref("employees"), count: employees.length }] : []),
          { key: "invoices", label: "Invoices", href: tabHref("invoices"), count: allInvoices.length },
          { key: "activity", label: "Activity", href: tabHref("activity") },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3">
                {details.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs font-medium text-zinc-500">{label}</dt>
                    <dd className="mt-0.5 truncate text-sm text-zinc-900">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Panel title="Recent invoices" count={allInvoices.length} action={<Link href={tabHref("invoices")} className="font-medium text-zinc-500 hover:text-zinc-900">View all</Link>}>
              <InvoiceTable rows={allInvoices.slice(0, 5)} totalOf={totalOf} />
            </Panel>
          </div>

          <div className="space-y-6">
            {isCompany && (
              <Card className="overflow-hidden">
                <div className="grid grid-cols-3 gap-px bg-zinc-200">
                  {[
                    ["Company cars", vehicleList.length],
                    ["Employees", employees.length],
                    ["Employee cars", employeeCars],
                  ].map(([label, n]) => (
                    <div key={label as string} className="bg-white p-3.5">
                      <p className="text-xs text-zinc-500">{label}</p>
                      <p className="mt-0.5 text-xl font-semibold tabular text-zinc-900">{n}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5 text-[13px]">
                  <span className="text-zinc-500">{companyPaidCars} employee cars billed to the company</span>
                  <Link href={tabHref("employees")} className="font-medium text-zinc-700 hover:text-zinc-900">
                    Employees →
                  </Link>
                </div>
              </Card>
            )}
            <Card className="p-5">
              <p className="text-[13px] font-medium text-zinc-500">Account balance</p>
              <p className={`mt-1.5 text-2xl font-semibold tracking-tight tabular ${accountBalance > 0.01 ? "text-red-700" : "text-emerald-700"}`}>
                {money(accountBalance)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {accountBalance > 0.01 ? "Outstanding" : "Nothing owed"} · Lifetime spend {money(lifetimeSpend)}
              </p>
              <dl className="mt-4 space-y-1.5 border-t border-zinc-100 pt-3 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Unpaid invoices</dt>
                  <dd className="text-zinc-900 tabular">{money(invoiceBalance)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Manual adjustments</dt>
                  <dd className="text-zinc-900 tabular">{money(adjustmentBalance)}</dd>
                </div>
              </dl>
            </Card>

            <Panel
              title="Balance adjustments"
              count={adjustments?.length ?? 0}
              action={
                <SlideOver
                  id="add-adjustment"
                  title="Add balance adjustment"
                  description="Use a negative amount for a credit or payment taken outside an invoice."
                  triggerLabel="Add"
                  variant="secondary"
                >
                  <form action={addBalanceAdjustment.bind(null, id)} className="space-y-4">
                    <Field label="Amount (AED)" name="amount" type="number" step="0.01" required />
                    <Field label="Note" name="note" placeholder="e.g. Old balance carried forward" required />
                    <PrimaryButton type="submit" className="w-full">
                      Add adjustment
                    </PrimaryButton>
                  </form>
                </SlideOver>
              }
            >
              {(adjustments?.length ?? 0) === 0 ? (
                <PanelEmpty message="No manual adjustments." />
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {adjustments!.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-zinc-900">{a.note}</p>
                        <p className="text-xs text-zinc-500">{formatDate(a.created_at)}</p>
                      </div>
                      <span className={`shrink-0 font-medium tabular ${a.amount > 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {a.amount > 0 ? "+" : ""}
                        {money(Number(a.amount))}
                      </span>
                      <RowMenu>
                        <RowMenuDelete
                          action={deleteBalanceAdjustment.bind(null, id, a.id)}
                          confirmMessage="Remove this balance adjustment?"
                          successMessage="Adjustment removed."
                          label="Remove"
                        />
                      </RowMenu>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      {tab === "vehicles" && (
        <Panel
          title="Vehicles"
          count={vehicleList.length}
          action={
            <SlideOver title="Add a vehicle" description="Plate, make and model are enough to start." triggerLabel="Add vehicle" variant="secondary">
              <form action={addVehicle.bind(null, id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <VehicleFields makeListId="vehicle-makes" modelListId="vehicle-models" required />
                <div className="col-span-full">
                  <PrimaryButton type="submit" className="w-full">
                    Add vehicle
                  </PrimaryButton>
                </div>
              </form>
            </SlideOver>
          }
        >
          {vehicleList.length === 0 ? (
            <PanelEmpty message="No vehicles on file yet." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {vehicleList.map((vehicle) => {
                const warranties = warrantyMap.get(vehicle.id) ?? [];
                const panelId = `edit-vehicle-${vehicle.id}`;
                return (
                  <li key={vehicle.id} className="flex items-center gap-4 px-4 py-3.5">
                    <PlateBadge plateNumber={vehicle.plate_number} emirate={vehicle.emirate} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/vehicles/${vehicle.id}/passport`} className="truncate font-medium text-zinc-900 hover:underline">
                        {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
                      </Link>
                      <p className="truncate text-xs text-zinc-500">
                        {[vehicle.year, vehicle.color, vehicle.body_type].filter(Boolean).join(" · ") || "—"}
                        {vehicle.service_interval_days ? ` · Service every ${vehicle.service_interval_days} days` : ""}
                      </p>
                    </div>
                    <div className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
                      {parentCompany && (vehicle.company_pays ? <Badge color="indigo">Company pays</Badge> : <Badge color="slate">Pays personally</Badge>)}
                      {warranties.length > 0 && (
                        <Badge color="green">
                          <Icon name="shield" className="h-3 w-3" />
                          Warranty until {formatDate(warranties[0].until)}
                        </Badge>
                      )}
                      {registrationBadge(vehicle.registration_expiry_date)}
                    </div>
                    <SlideOver id={panelId} hideTrigger title={`Edit ${vehicle.plate_number}`} description="Vehicle details and service schedule." triggerLabel="Edit">
                      <form action={updateVehicle.bind(null, id, vehicle.id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <VehicleFields vehicle={vehicle} makeListId="vehicle-makes" modelListId="vehicle-models" required />
                        <div className="col-span-full">
                          <PrimaryButton type="submit" className="w-full">
                            Save vehicle
                          </PrimaryButton>
                        </div>
                      </form>
                      <form action={updateVehicleServiceInterval.bind(null, id, vehicle.id)} className="mt-6 border-t border-zinc-200 pt-5">
                        <p className="mb-3 text-sm font-semibold text-zinc-900">Service reminder</p>
                        <div className="flex items-end gap-2">
                          <Field
                            label="Remind every (days)"
                            name="service_interval_days"
                            type="number"
                            defaultValue={vehicle.service_interval_days ?? ""}
                            placeholder="90"
                            className="flex-1"
                          />
                          <SecondaryButton type="submit">Save</SecondaryButton>
                        </div>
                      </form>
                    </SlideOver>
                    <RowMenu>
                      <RowMenuLink href={`/vehicles/${vehicle.id}/passport`} icon="car">
                        Vehicle passport
                      </RowMenuLink>
                      <RowMenuLink href={`/vehicles/${vehicle.id}/qr`} icon="scan">
                        QR code
                      </RowMenuLink>
                      <RowMenuOpenPanel panelId={panelId} icon="pencil">
                        Edit vehicle
                      </RowMenuOpenPanel>
                      {parentCompany && (
                        <RowMenuAction
                          action={setVehicleCompanyPays.bind(null, id, vehicle.id, !vehicle.company_pays)}
                          icon="wallet"
                          successMessage={vehicle.company_pays ? "Now billed to the employee." : `Now billed to ${parentCompany.name}.`}
                        >
                          {vehicle.company_pays ? "Bill the employee instead" : `Bill ${parentCompany.name} instead`}
                        </RowMenuAction>
                      )}
                      <RowMenuSeparator />
                      <RowMenuDelete
                        action={deleteVehicle.bind(null, id, vehicle.id)}
                        confirmMessage={`Delete vehicle "${vehicle.plate_number}"?`}
                        successMessage="Vehicle deleted."
                      />
                    </RowMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {tab === "employees" && isCompany && (
        <Panel
          title="Employees"
          count={employees.length}
          action={
            <span className="flex items-center gap-2">
              <Link href={`/customers/new?company=${id}`} className="hidden font-medium text-zinc-500 hover:text-zinc-900 sm:inline">
                Full form
              </Link>
              <SlideOver
                id="add-employee"
                title={`Add employee · ${customer.name}`}
                description="A person who works for this company. Add their car now or later."
                triggerLabel="Add employee"
                variant="secondary"
              >
                <form action={addEmployee.bind(null, id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full name" name="name" required className="sm:col-span-2" />
                  <Field label="Mobile" name="phone" required />
                  <Field label="Job title" name="job_title" placeholder="e.g. Driver, Consul" />
                  <p className="border-t border-zinc-200 pt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">Their car (optional)</p>
                  <VehicleFields makeListId="vehicle-makes" modelListId="vehicle-models" />
                  <label className="flex items-start gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-[13px] text-zinc-700 sm:col-span-2">
                    <input type="checkbox" name="company_pays" defaultChecked className="mt-0.5 h-4 w-4 accent-zinc-900" />
                    <span>
                      <span className="block font-medium text-zinc-900">{customer.name} pays for this car</span>
                      Untick if the employee pays personally. You can still change it on each job.
                    </span>
                  </label>
                  <div className="sm:col-span-2">
                    <PrimaryButton type="submit" className="w-full">
                      Add employee
                    </PrimaryButton>
                  </div>
                </form>
              </SlideOver>
            </span>
          }
        >
          {employees.length === 0 ? (
            <PanelEmpty message="No employees linked yet. Add the people who bring cars on behalf of this company." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {employees.map((e) => (
                <li key={e.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600">
                      {e.name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase())
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/customers/${e.id}`} className="block truncate font-medium text-zinc-900 hover:underline">
                        {e.name}
                      </Link>
                      <p className="truncate text-xs text-zinc-500">{[e.job_title, e.phone].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {e.vehicles.length === 0 ? (
                      <span className="text-xs text-zinc-400">No car yet</span>
                    ) : (
                      e.vehicles.map((v) => (
                        <Link key={v.id} href={`/vehicles/${v.id}/passport`} className="flex items-center gap-1.5" title={v.company_pays ? "Company pays" : "Employee pays"}>
                          <PlateBadge plateNumber={v.plate_number} emirate={v.emirate} />
                          <span className={`h-2 w-2 rounded-full ${v.company_pays ? "bg-zinc-900" : "bg-zinc-300"}`} />
                        </Link>
                      ))
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <RowMenu>
                      <RowMenuLink href={`/customers/${e.id}`} icon="user">
                        Open employee
                      </RowMenuLink>
                      <RowMenuLink href={`/customers/${e.id}?tab=vehicles`} icon="car">
                        Cars & who pays
                      </RowMenuLink>
                      <RowMenuSeparator />
                      <RowMenuDelete
                        action={unlinkEmployee.bind(null, id, e.id)}
                        confirmMessage={`Remove ${e.name} from ${customer.name}? They stay as a private customer with their cars and history.`}
                        successMessage="Employee unlinked."
                        label="Remove from company"
                      />
                    </RowMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {employees.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-200 bg-zinc-50/60 px-4 py-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-900" /> Company pays
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-300" /> Employee pays
              </span>
              <span className="ml-auto">Company-paid jobs appear on this company&apos;s statement.</span>
            </div>
          )}
        </Panel>
      )}

      {tab === "invoices" && (
        <Panel title="Invoices & estimates" count={allInvoices.length}>
          <InvoiceTable rows={allInvoices} totalOf={totalOf} />
        </Panel>
      )}

      {tab === "activity" && (
        <Panel title="Activity" action={<span className="text-xs text-zinc-500">Newest first</span>}>
          <ActivityTimeline events={activity} />
        </Panel>
      )}
    </div>
  );
}

function InvoiceTable({ rows, totalOf }: { rows: CustomerInvoiceRow[]; totalOf: (i: CustomerInvoiceRow) => number }) {
  if (rows.length === 0) return <PanelEmpty message="No invoices or estimates yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={theadClass}>
          <tr>
            <th className={thClass}>Document</th>
            <th className={`${thClass} hidden sm:table-cell`}>Date</th>
            <th className={`${thClass} text-right`}>Amount</th>
            <th className={thClass}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => {
            const isEstimate = inv.document_type === "estimate";
            const href = isEstimate ? `/estimates/${inv.id}` : `/invoices/${inv.id}`;
            return (
              <tr key={inv.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                <td className="px-4 py-2.5">
                  <Link href={href} className="font-display text-[15px] font-semibold tracking-[0.02em] text-zinc-900 hover:underline">
                    {isEstimate ? "Estimate" : formatInvoiceNumber(inv.invoice_number, inv.created_at) ?? "Invoice"}
                  </Link>
                  <p className="text-xs text-zinc-500 tabular sm:hidden">{formatDate(inv.created_at)}</p>
                </td>
                <td className="hidden px-4 py-2.5 text-zinc-500 tabular sm:table-cell">{formatDate(inv.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-zinc-900 tabular">{money(totalOf(inv))}</td>
                <td className="px-4 py-2.5">
                  {isEstimate ? (
                    <Badge color="slate">Estimate</Badge>
                  ) : (
                    <Badge color={STATUS_COLOR[inv.status]} dot>
                      {inv.status}
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
