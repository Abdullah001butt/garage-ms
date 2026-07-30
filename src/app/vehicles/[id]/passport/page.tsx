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
import { Card, PageHeader, Badge, EmptyState, Field, SecondaryButton, PrimaryButton, labelClass, inputClass } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { PlateBadge } from "@/components/PlateBadge";

type VehicleWithCustomer = {
  id: string;
  plate_number: string;
  emirate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vin: string | null;
  customer_id: string;
  created_at: string;
  customers: { name: string; phone: string } | null;
};

type JobHistoryRow = {
  id: string;
  description: string;
  status: string;
  mechanic_name: string | null;
  created_at: string;
  completed_at: string | null;
  invoices: {
    id: string;
    document_type: string;
    invoice_items: { description: string; item_type: string; quantity: number; unit_price: number; warranty_days: number | null }[];
  }[];
};

type CustomerOption = { id: string; name: string };

export default async function VehiclePassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: vehicle }, { data: jobHistory }, { data: incidents }, { data: documents }, { data: customers }] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select("id, plate_number, emirate, make, model, year, color, vin, customer_id, created_at, customers(name, phone)")
        .eq("id", id)
        .single<VehicleWithCustomer>(),
      supabase
        .from("job_cards")
        .select(
          "id, description, status, mechanic_name, created_at, completed_at, invoices(id, document_type, invoice_items(description, item_type, quantity, unit_price, warranty_days))"
        )
        .eq("vehicle_id", id)
        .order("created_at", { ascending: false })
        .returns<JobHistoryRow[]>(),
      supabase
        .from("vehicle_incidents")
        .select("*")
        .eq("vehicle_id", id)
        .order("incident_date", { ascending: false })
        .returns<VehicleIncident[]>(),
      supabase
        .from("vehicle_documents")
        .select("*")
        .eq("vehicle_id", id)
        .order("uploaded_at", { ascending: false })
        .returns<VehicleDocument[]>(),
      supabase.from("customers").select("id, name").order("name").returns<CustomerOption[]>(),
    ]);

  if (!vehicle) {
    notFound();
  }

  const now = Date.now();
  const warrantyItems = (jobHistory ?? [])
    .flatMap((job) =>
      (job.invoices ?? [])
        .filter((inv) => inv.document_type === "invoice")
        .flatMap((inv) =>
          inv.invoice_items
            .filter((item) => item.warranty_days)
            .map((item) => ({
              description: item.description,
              until: new Date(new Date(job.created_at).getTime() + (item.warranty_days ?? 0) * 86400000),
            }))
        )
    )
    .sort((a, b) => b.until.getTime() - a.until.getTime());

  const partsReplaced = (jobHistory ?? [])
    .flatMap((job) => (job.invoices ?? []).flatMap((inv) => inv.invoice_items))
    .filter((item) => item.item_type === "part");

  const transferWithId = transferVehicleOwnership.bind(null, id);
  const addIncidentWithId = addVehicleIncident.bind(null, id);
  const uploadDocumentWithId = uploadVehicleDocument.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link href={`/customers/${vehicle.customer_id}`} className="text-sm text-indigo-600 hover:underline">
        &larr; Back to customer
      </Link>
      <div className="mt-3 mb-1">
        <PlateBadge plateNumber={vehicle.plate_number} emirate={vehicle.emirate} size="lg" />
      </div>
      <PageHeader
        title={[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle Passport"}
        description="Permanent vehicle history — survives even if ownership changes."
      />

      <Card className="p-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
          <div>
            <p className="text-xs text-slate-400">Year</p>
            <p className="font-medium text-slate-900">{vehicle.year ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Color</p>
            <p className="font-medium text-slate-900">{vehicle.color ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">VIN</p>
            <p className="font-medium text-slate-900">{vehicle.vin ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">On File Since</p>
            <p className="font-medium text-slate-900">{new Date(vehicle.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 mb-3">
          Current Owner: <span className="font-medium">{vehicle.customers?.name}</span> ({vehicle.customers?.phone})
        </p>
        <details>
          <summary className="cursor-pointer text-xs text-indigo-600 hover:underline">
            Transfer ownership to a different customer
          </summary>
          <form action={transferWithId} className="mt-2 flex flex-wrap items-end gap-2">
            <label className="block">
              <span className={labelClass}>New Owner</span>
              <select name="new_customer_id" required className={inputClass}>
                <option value="">Select customer...</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <SecondaryButton type="submit">Transfer</SecondaryButton>
          </form>
        </details>
      </Card>

      <h2 className="text-sm font-semibold text-slate-700 mb-2">Service History</h2>
      <Card className="mb-6 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {jobHistory?.map((job) => (
            <li key={job.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/jobs/${job.id}`} className="font-medium text-slate-900 hover:underline">
                    {job.description}
                  </Link>
                  {job.mechanic_name && <p className="text-xs text-slate-500">Mechanic: {job.mechanic_name}</p>}
                  {job.invoices?.[0]?.invoice_items?.length ? (
                    <ul className="mt-1 text-xs text-slate-400 list-disc list-inside">
                      {job.invoices[0].invoice_items.map((item, i) => (
                        <li key={i}>
                          {item.quantity} × {item.description} — AED {(item.quantity * item.unit_price).toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <Badge color={job.status === "completed" ? "green" : "amber"}>{job.status}</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">{new Date(job.created_at).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
        {jobHistory?.length === 0 && <EmptyState message="No service history recorded for this vehicle yet." />}
      </Card>

      {warrantyItems.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Warranty History</h2>
          <Card className="mb-6 overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {warrantyItems.map((w, i) => (
                <li key={i} className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700">{w.description}</span>
                  <Badge color={w.until.getTime() > now ? "green" : "gray"}>
                    {w.until.getTime() > now ? "Active until" : "Expired"} {w.until.toLocaleDateString()}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {partsReplaced.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Parts Replaced (All Time)</h2>
          <Card className="mb-6 p-4">
            <ul className="text-sm text-slate-600 space-y-1">
              {partsReplaced.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>{p.description}</span>
                  <span className="text-slate-400">×{p.quantity}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <h2 className="text-sm font-semibold text-slate-700 mb-2">Accident / Incident Records</h2>
      <Card className="mb-6 p-4">
        <ul className="divide-y divide-slate-100 mb-3">
          {incidents?.map((inc) => (
            <li key={inc.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="text-slate-700">{inc.description}</p>
                <p className="text-xs text-slate-400">{new Date(inc.incident_date).toLocaleDateString()}</p>
              </div>
              <ConfirmSubmitButton
                action={deleteVehicleIncident.bind(null, id, inc.id)}
                confirmMessage="Remove this incident record?"
                successMessage="Removed."
              >
                Remove
              </ConfirmSubmitButton>
            </li>
          ))}
          {incidents?.length === 0 && <EmptyState message="No incidents recorded." />}
        </ul>
        <details>
          <summary className="cursor-pointer text-xs text-indigo-600 hover:underline">+ Add incident</summary>
          <form action={addIncidentWithId} className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Date" name="incident_date" type="date" required />
            <Field label="Description" name="description" placeholder="e.g. Front bumper collision" required className="sm:col-span-2" />
            <div className="sm:col-span-3">
              <SecondaryButton type="submit">Add Incident</SecondaryButton>
            </div>
          </form>
        </details>
      </Card>

      <h2 className="text-sm font-semibold text-slate-700 mb-2">Photos & Documents</h2>
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {documents?.map((doc) => {
            const { data: urlData } = supabase.storage.from("vehicle-files").getPublicUrl(doc.file_path);
            const isImage = doc.file_type?.startsWith("image/");
            return (
              <div key={doc.id} className="rounded-lg border border-slate-200 p-2">
                {isImage ? (
                  <a href={urlData.publicUrl} target="_blank" rel="noopener noreferrer">
                    <img src={urlData.publicUrl} alt={doc.file_name} className="h-24 w-full rounded object-cover" />
                  </a>
                ) : (
                  <a
                    href={urlData.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-24 items-center justify-center rounded bg-slate-50 text-xs text-indigo-600 hover:underline"
                  >
                    📄 View File
                  </a>
                )}
                <p className="mt-1 truncate text-xs text-slate-500">{doc.file_name}</p>
                <ConfirmSubmitButton
                  action={deleteVehicleDocument.bind(null, id, doc.id, doc.file_path)}
                  confirmMessage="Delete this file?"
                  successMessage="Deleted."
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </ConfirmSubmitButton>
              </div>
            );
          })}
        </div>
        {documents?.length === 0 && <EmptyState message="No photos or documents uploaded yet." />}
        <form action={uploadDocumentWithId} className="flex flex-wrap items-end gap-2">
          <input type="file" name="file" required className="text-sm" />
          <PrimaryButton type="submit">Upload</PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
