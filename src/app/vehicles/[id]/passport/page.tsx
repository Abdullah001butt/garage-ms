import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { VehicleIncident, VehicleDocument } from "@/lib/types";
import {
  transferVehicleOwnership,
  addVehicleIncident,
  deleteVehicleIncident,
  uploadVehicleDocument,
  deleteVehicleDocument,
} from "@/app/vehicles/actions";
import { Card, Panel, PanelEmpty, Badge, Field, SecondaryButton, PrimaryButton, labelClass, inputClass, theadClass, thClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PlateBadge } from "@/components/PlateBadge";
import { ShareCertificateButton } from "@/components/ShareCertificateButton";
import { SlideOver } from "@/components/SlideOver";
import { TabLinks } from "@/components/Tabs";
import { RowMenu, RowMenuDelete, RowMenuLink, RowMenuOpenPanel, RowMenuSeparator } from "@/components/RowMenu";
import { formatDate } from "@/lib/format";

type VehicleWithCustomer = {
  id: string;
  plate_number: string;
  emirate: string;
  registration_expiry_date: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  origin_trim: string | null;
  color: string | null;
  vin: string | null;
  body_type: string | null;
  cylinders: number | null;
  current_mileage: number | null;
  odometer_reading: number | null;
  customer_id: string;
  created_at: string;
  share_token: string | null;
  customers: { name: string; phone: string } | null;
};

type JobHistoryRow = {
  id: string;
  description: string;
  status: string;
  mechanic_name: string | null;
  odometer: number | null;
  created_at: string;
  completed_at: string | null;
  invoices: {
    id: string;
    document_type: string;
    invoice_items: { description: string; item_type: string; quantity: number; unit_price: number; warranty_days: number | null }[];
  }[];
};

type CustomerOption = { id: string; name: string };

const TABS = ["overview", "history", "warranty", "incidents", "documents"] as const;
type Tab = (typeof TABS)[number];

const JOB_STATUS_COLOR: Record<string, "slate" | "amber" | "green"> = { pending: "slate", in_progress: "amber", completed: "green" };

function aed(n: number) {
  return `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function VehiclePassportPage({
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

  const [{ data: vehicle }, { data: jobHistory }, { data: incidents }, { data: documents }, { data: customers }] = await Promise.all([
    supabase
      .from("vehicles")
      .select(
        "id, plate_number, emirate, registration_expiry_date, make, model, year, origin_trim, color, vin, body_type, cylinders, current_mileage, odometer_reading, customer_id, created_at, share_token, customers(name, phone)"
      )
      .eq("id", id)
      .single<VehicleWithCustomer>(),
    supabase
      .from("job_cards")
      .select(
        "id, description, status, mechanic_name, odometer, created_at, completed_at, invoices(id, document_type, invoice_items(description, item_type, quantity, unit_price, warranty_days))"
      )
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false })
      .returns<JobHistoryRow[]>(),
    supabase.from("vehicle_incidents").select("*").eq("vehicle_id", id).order("incident_date", { ascending: false }).returns<VehicleIncident[]>(),
    supabase.from("vehicle_documents").select("*").eq("vehicle_id", id).order("uploaded_at", { ascending: false }).returns<VehicleDocument[]>(),
    supabase.from("customers").select("id, name").order("name").returns<CustomerOption[]>(),
  ]);

  if (!vehicle) notFound();

  const jobs = jobHistory ?? [];
  const nowMs = new Date().getTime();
  const warrantyItems = jobs
    .flatMap((job) =>
      (job.invoices ?? [])
        .filter((inv) => inv.document_type === "invoice")
        .flatMap((inv) =>
          inv.invoice_items
            .filter((item) => item.warranty_days)
            .map((item) => ({
              description: item.description,
              jobId: job.id,
              from: job.created_at,
              until: new Date(new Date(job.created_at).getTime() + (item.warranty_days ?? 0) * 86400000),
            }))
        )
    )
    .sort((a, b) => b.until.getTime() - a.until.getTime());
  const activeWarranties = warrantyItems.filter((w) => w.until.getTime() > nowMs);
  const partsReplaced = jobs
    .flatMap((job) => (job.invoices ?? []).flatMap((inv) => inv.invoice_items.map((it) => ({ ...it, date: job.created_at }))))
    .filter((item) => item.item_type === "part");
  const lastService = jobs.find((j) => j.status === "completed");
  const lifetimeSpend = jobs.reduce(
    (s, j) =>
      s +
      (j.invoices ?? [])
        .filter((inv) => inv.document_type === "invoice")
        .reduce((a, inv) => a + inv.invoice_items.reduce((b, it) => b + it.quantity * it.unit_price, 0), 0),
    0
  );

  const base = `/vehicles/${id}/passport`;
  const tabHref = (key: Tab) => (key === "overview" ? base : `${base}?tab=${key}`);
  const title = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle";

  const regDaysLeft = vehicle.registration_expiry_date
    ? Math.ceil((new Date(vehicle.registration_expiry_date).getTime() - nowMs) / 86400000)
    : null;

  const specs: [string, string][] = [
    ["Year", vehicle.year ? String(vehicle.year) : "—"],
    ["Color", vehicle.color ?? "—"],
    ["Body type", vehicle.body_type ?? "—"],
    ["Origin / trim", vehicle.origin_trim ?? "—"],
    ["Cylinders", vehicle.cylinders ? String(vehicle.cylinders) : "—"],
    ["VIN / chassis", vehicle.vin ?? "—"],
    ["Current mileage", vehicle.current_mileage ? `${Number(vehicle.current_mileage).toLocaleString("en-US")} km` : "—"],
    ["Odometer reading", vehicle.odometer_reading ? `${Number(vehicle.odometer_reading).toLocaleString("en-US")} km` : "—"],
    ["Registration expiry", formatDate(vehicle.registration_expiry_date)],
    ["Emirate", vehicle.emirate],
    ["On file since", formatDate(vehicle.created_at)],
  ];

  return (
    <div className="page">
      <Link href={`/customers/${vehicle.customer_id}?tab=vehicles`} className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-900">
        ← Back to {vehicle.customers?.name ?? "customer"}
      </Link>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <PlateBadge plateNumber={vehicle.plate_number} emirate={vehicle.emirate} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-[22px]">
                {title}
                {vehicle.year ? <span className="font-normal text-zinc-400"> {vehicle.year}</span> : null}
              </h1>
              {activeWarranties.length > 0 && (
                <Badge color="green">
                  <Icon name="shield" className="h-3 w-3" />
                  Under warranty
                </Badge>
              )}
              {regDaysLeft !== null && regDaysLeft < 0 && <Badge color="red">Registration expired</Badge>}
              {regDaysLeft !== null && regDaysLeft >= 0 && regDaysLeft <= 30 && <Badge color="amber">Registration due soon</Badge>}
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Owner{" "}
              <Link href={`/customers/${vehicle.customer_id}`} className="font-medium text-zinc-700 hover:underline">
                {vehicle.customers?.name}
              </Link>
              {vehicle.customers?.phone ? ` · ${vehicle.customers.phone}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap">
          {vehicle.share_token && <ShareCertificateButton shareToken={vehicle.share_token} />}
          <Link href="/jobs/new">
            <PrimaryButton type="button" icon="wrench">
              New job card
            </PrimaryButton>
          </Link>
          <div className="rounded-md border border-zinc-300 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
            <RowMenu label="More actions">
              <RowMenuLink href={`/vehicles/${id}/qr`} icon="scan">
                QR code
              </RowMenuLink>
              <RowMenuOpenPanel panelId="transfer-owner" icon="user">
                Transfer ownership
              </RowMenuOpenPanel>
            </RowMenu>
          </div>
        </div>
      </div>

      <SlideOver id="transfer-owner" hideTrigger title="Transfer ownership" description="Move this vehicle and its full history to another customer." triggerLabel="Transfer">
        <form action={transferVehicleOwnership.bind(null, id)} className="space-y-4">
          <label className="block">
            <span className={labelClass}>New owner</span>
            <select name="new_customer_id" required className={inputClass}>
              <option value="">Select customer…</option>
              {customers
                ?.filter((c) => c.id !== vehicle.customer_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="text-xs text-zinc-500">Service history, warranties, incidents and documents stay with the vehicle.</p>
          <PrimaryButton type="submit" className="w-full">
            Transfer vehicle
          </PrimaryButton>
        </form>
      </SlideOver>

      <TabLinks
        active={tab}
        tabs={[
          { key: "overview", label: "Overview", href: tabHref("overview") },
          { key: "history", label: "Service history", href: tabHref("history"), count: jobs.length },
          { key: "warranty", label: "Warranty & parts", href: tabHref("warranty"), count: activeWarranties.length },
          { key: "incidents", label: "Incidents", href: tabHref("incidents"), count: incidents?.length ?? 0 },
          { key: "documents", label: "Documents", href: tabHref("documents"), count: documents?.length ?? 0 },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3">
              {specs.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs font-medium text-zinc-500">{label}</dt>
                  <dd className="mt-0.5 truncate text-sm text-zinc-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <div className="grid grid-cols-2 gap-3 self-start">
            <SummaryTile label="Jobs on record" value={String(jobs.length)} />
            <SummaryTile label="Last service" value={lastService ? formatDate(lastService.completed_at ?? lastService.created_at) : "—"} />
            <SummaryTile label="Active warranties" value={String(activeWarranties.length)} />
            <SummaryTile label="Lifetime spend" value={aed(lifetimeSpend)} />
          </div>
        </div>
      )}

      {tab === "history" && (
        <Panel title="Service history" count={jobs.length}>
          {jobs.length === 0 ? (
            <PanelEmpty message="No service history recorded for this vehicle yet." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {jobs.map((job) => {
                const items = job.invoices?.find((i) => i.document_type === "invoice")?.invoice_items ?? job.invoices?.[0]?.invoice_items ?? [];
                const total = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
                return (
                  <li key={job.id} className="px-4 py-3.5">
                    <div className="flex items-start gap-4">
                      <div className="w-24 shrink-0 text-xs text-zinc-500 tabular">
                        <p className="font-medium text-zinc-900">{formatDate(job.created_at)}</p>
                        {job.odometer ? <p>{Number(job.odometer).toLocaleString("en-US")} km</p> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/jobs/${job.id}`} className="font-medium text-zinc-900 hover:underline">
                          {job.description}
                        </Link>
                        <p className="text-xs text-zinc-500">{job.mechanic_name ? `Mechanic: ${job.mechanic_name}` : "No mechanic assigned"}</p>
                        {items.length > 0 && (
                          <ul className="mt-2 space-y-0.5 text-xs text-zinc-600">
                            {items.map((item, i) => (
                              <li key={i} className="flex justify-between gap-4">
                                <span className="truncate">
                                  {item.quantity} × {item.description}
                                </span>
                                <span className="shrink-0 tabular">{aed(item.quantity * item.unit_price)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge color={JOB_STATUS_COLOR[job.status] ?? "slate"} dot>
                          {job.status}
                        </Badge>
                        {total > 0 && <span className="text-xs font-medium text-zinc-900 tabular">{aed(total)}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {tab === "warranty" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Warranties" count={warrantyItems.length}>
            {warrantyItems.length === 0 ? (
              <PanelEmpty message="No warranty items on record." />
            ) : (
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Item</th>
                    <th className={thClass}>Fitted</th>
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {warrantyItems.map((w, i) => {
                    const active = w.until.getTime() > nowMs;
                    return (
                      <tr key={i} className="border-b border-zinc-100 last:border-0">
                        <td className="px-4 py-2.5 text-zinc-900">{w.description}</td>
                        <td className="px-4 py-2.5 text-zinc-500 tabular">{formatDate(w.from)}</td>
                        <td className="px-4 py-2.5">
                          <Badge color={active ? "green" : "gray"}>
                            {active ? "Active until" : "Expired"} {formatDate(w.until)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
          <Panel title="Parts replaced" count={partsReplaced.length}>
            {partsReplaced.length === 0 ? (
              <PanelEmpty message="No parts recorded yet." />
            ) : (
              <table className="w-full text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className={thClass}>Part</th>
                    <th className={`${thClass} text-right`}>Qty</th>
                    <th className={`${thClass} text-right`}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {partsReplaced.map((p, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-2.5 text-zinc-900">{p.description}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-600 tabular">{p.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 tabular">{formatDate(p.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      )}

      {tab === "incidents" && (
        <Panel
          title="Accident & incident records"
          count={incidents?.length ?? 0}
          action={
            <SlideOver title="Add incident" description="Accidents, damage or anything worth remembering about this vehicle." triggerLabel="Add incident" variant="secondary">
              <form action={addVehicleIncident.bind(null, id)} className="space-y-4">
                <Field label="Date" name="incident_date" type="date" required />
                <Field label="Description" name="description" placeholder="e.g. Front bumper collision" required />
                <PrimaryButton type="submit" className="w-full">
                  Add incident
                </PrimaryButton>
              </form>
            </SlideOver>
          }
        >
          {(incidents?.length ?? 0) === 0 ? (
            <PanelEmpty message="No incidents recorded." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {incidents!.map((inc) => (
                <li key={inc.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                    <Icon name="alert" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-900">{inc.description}</p>
                    <p className="text-xs text-zinc-500">{formatDate(inc.incident_date)}</p>
                  </div>
                  <RowMenu>
                    <RowMenuDelete action={deleteVehicleIncident.bind(null, id, inc.id)} confirmMessage="Remove this incident record?" successMessage="Incident removed." label="Remove" />
                  </RowMenu>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "documents" && (
        <Panel
          title="Photos & documents"
          count={documents?.length ?? 0}
          action={
            <SlideOver title="Upload a file" description="Photos, Mulkiya copy, inspection reports — any image or PDF." triggerLabel="Upload" triggerIcon="download" variant="secondary">
              <form action={uploadVehicleDocument.bind(null, id)} className="space-y-4">
                <label className="block">
                  <span className={labelClass}>File</span>
                  <input
                    type="file"
                    name="file"
                    required
                    className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-50"
                  />
                </label>
                <PrimaryButton type="submit" className="w-full">
                  Upload
                </PrimaryButton>
              </form>
            </SlideOver>
          }
        >
          {(documents?.length ?? 0) === 0 ? (
            <PanelEmpty message="No photos or documents uploaded yet." />
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
              {documents!.map((doc) => {
                const { data: urlData } = supabase.storage.from("vehicle-files").getPublicUrl(doc.file_path);
                const isImage = doc.file_type?.startsWith("image/");
                return (
                  <div key={doc.id} data-row className="group overflow-hidden rounded-md border border-zinc-200 bg-white">
                    <a href={urlData.publicUrl} target="_blank" rel="noopener noreferrer" className="block">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urlData.publicUrl} alt={doc.file_name} className="h-28 w-full object-cover" />
                      ) : (
                        <span className="flex h-28 flex-col items-center justify-center gap-1 bg-zinc-50 text-xs font-medium text-zinc-600">
                          <Icon name="file" className="h-6 w-6 text-zinc-400" />
                          View file
                        </span>
                      )}
                    </a>
                    <div className="flex items-center gap-1 border-t border-zinc-100 py-1 pl-2.5 pr-1">
                      <p className="min-w-0 flex-1 truncate text-xs text-zinc-600">{doc.file_name}</p>
                      <RowMenu>
                        <RowMenuLink href={urlData.publicUrl} icon="download">
                          Open
                        </RowMenuLink>
                        <RowMenuSeparator />
                        <RowMenuDelete action={deleteVehicleDocument.bind(null, id, doc.id, doc.file_path)} confirmMessage="Delete this file?" successMessage="File deleted." />
                      </RowMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-900 tabular">{value}</p>
    </Card>
  );
}
