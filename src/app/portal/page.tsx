import { createClient } from "@/lib/supabase/server";
import { Card, Badge, inputClass, labelClass } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PlateBadge } from "@/components/PlateBadge";
import { PublicShell, SHOP_CONTACT } from "@/components/PublicShell";
import { formatDate, formatDateTime } from "@/lib/format";

type PortalJob = {
  description: string;
  status: "pending" | "in_progress" | "completed";
  mechanic_name: string | null;
  created_at: string;
  completed_at: string | null;
};

type PortalAppointment = {
  scheduled_at: string;
  status: "scheduled" | "completed" | "cancelled";
  notes: string | null;
};

type PortalWarranty = { description: string; until: string };

type PortalResult = {
  customer_name: string;
  vehicle: { plate_number: string; make: string | null; model: string | null; year: number | null };
  jobs: PortalJob[];
  appointments: PortalAppointment[];
  warranties: PortalWarranty[];
};

const JOB_STATUS_COLOR: Record<string, "slate" | "amber" | "green"> = { pending: "slate", in_progress: "amber", completed: "green" };
const APT_STATUS_COLOR: Record<string, "blue" | "green" | "gray"> = { scheduled: "blue", completed: "green", cancelled: "gray" };

function StatusTracker({ job }: { job: PortalJob }) {
  const steps = [
    { label: "Received", detail: formatDateTime(job.created_at) },
    { label: "In progress", detail: job.mechanic_name ? `Technician: ${job.mechanic_name}` : "Being worked on" },
    { label: job.status === "completed" ? "Ready for pickup" : "Ready", detail: job.completed_at ? formatDateTime(job.completed_at) : "We'll let you know" },
  ];
  const reached = job.status === "pending" ? 0 : job.status === "in_progress" ? 1 : 2;
  const headline =
    job.status === "completed" ? "Your vehicle is ready for pickup" : job.status === "in_progress" ? "Work is in progress" : "We've received your vehicle";

  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-4 ${job.status === "completed" ? "bg-emerald-50" : "bg-zinc-50"} border-b border-zinc-200`}>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Current status</p>
        <p className={`mt-1 text-lg font-semibold ${job.status === "completed" ? "text-emerald-800" : "text-zinc-900"}`}>{headline}</p>
        <p className="mt-0.5 text-sm text-zinc-600">{job.description}</p>
      </div>
      <ol className="grid gap-4 p-5 sm:grid-cols-3">
        {steps.map((step, i) => {
          const done = i < reached || (i === reached && job.status === "completed");
          const current = i === reached && job.status !== "completed";
          return (
            <li key={step.label} className="flex gap-3 sm:flex-col sm:gap-2">
              <div className="flex items-center gap-2 sm:w-full">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done ? "bg-zinc-900 text-white" : current ? "bg-brand-600 text-white ring-4 ring-brand-100" : "border border-zinc-300 bg-white text-zinc-400"
                  }`}
                >
                  {done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {i < steps.length - 1 && <span className={`hidden h-px flex-1 sm:block ${i < reached ? "bg-zinc-900" : "bg-zinc-200"}`} />}
              </div>
              <div>
                <p className={`text-sm font-medium ${done || current ? "text-zinc-900" : "text-zinc-400"}`}>{step.label}</p>
                <p className="text-xs text-zinc-500">{done || current ? step.detail : "—"}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ phone?: string; plate?: string }> }) {
  const { phone, plate } = await searchParams;
  const searched = Boolean(phone && plate);

  let result: PortalResult | null = null;
  let queryError: string | null = null;

  if (searched) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("portal_lookup", { p_phone: phone, p_plate: plate });
    if (error) queryError = error.message;
    else result = data as PortalResult | null;
  }

  // Show the tracker for an open job, or for one finished in the last 3 days (awaiting pickup).
  const nowMs = new Date().getTime();
  const recentlyDone = result?.jobs.find(
    (j) => j.status === "completed" && j.completed_at && nowMs - new Date(j.completed_at).getTime() < 3 * 86400000
  );
  const activeJob = result?.jobs.find((j) => j.status !== "completed") ?? recentlyDone ?? null;
  const upcoming = result?.appointments.filter((a) => a.status === "scheduled") ?? [];

  return (
    <PublicShell active="portal">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Track my vehicle</h1>
        <p className="mt-2 text-sm text-zinc-500">Enter the mobile number and plate we have on file to see live status and your service history.</p>

        <Card className="mt-6 p-5">
          <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className={labelClass}>Mobile number</span>
              <input type="tel" name="phone" defaultValue={phone ?? ""} required placeholder="e.g. 050 123 4567" className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Plate number</span>
              <input type="text" name="plate" defaultValue={plate ?? ""} required placeholder="e.g. A 12345" className={inputClass} />
            </label>
            <button
              type="submit"
              className="inline-flex h-9.5 items-center justify-center gap-1.5 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Icon name="search" className="h-4 w-4" />
              Check status
            </button>
          </form>
        </Card>

        {queryError && (
          <p className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <Icon name="alert" className="mt-0.5 h-4 w-4 text-red-600" />
            {queryError}
          </p>
        )}

        {searched && !queryError && !result && (
          <Card className="mt-6 flex flex-col items-center px-5 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <Icon name="search" className="h-5 w-5" />
            </span>
            <p className="mt-3 font-medium text-zinc-900">No vehicle found</p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              Check the mobile number and plate exactly as given to us, or call {SHOP_CONTACT.phone} and we&apos;ll help.
            </p>
          </Card>
        )}

        {result && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <PlateBadge plateNumber={result.vehicle.plate_number} size="lg" />
              <div>
                <p className="text-lg font-semibold text-zinc-900">
                  {[result.vehicle.make, result.vehicle.model].filter(Boolean).join(" ") || "Your vehicle"}
                  {result.vehicle.year ? <span className="font-normal text-zinc-400"> {result.vehicle.year}</span> : null}
                </p>
                <p className="text-sm text-zinc-500">Registered to {result.customer_name}</p>
              </div>
            </div>

            {activeJob && <StatusTracker job={activeJob} />}

            {upcoming.length > 0 && (
              <Card className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700">
                  <Icon name="calendar" className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-900">Upcoming appointment</p>
                  <p className="text-sm text-zinc-600">{formatDateTime(upcoming[0].scheduled_at)}</p>
                </div>
              </Card>
            )}

            {result.warranties.length > 0 && (
              <Card className="overflow-hidden">
                <div className="border-b border-zinc-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-zinc-900">Active warranty</h2>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {result.warranties.map((w, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="flex items-center gap-2 text-zinc-900">
                        <Icon name="shield" className="h-4 w-4 text-emerald-600" />
                        {w.description}
                      </span>
                      <Badge color="green">Until {formatDate(w.until)}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="border-b border-zinc-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-zinc-900">Service history</h2>
              </div>
              {result.jobs.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400">No service records yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {result.jobs.map((job, i) => (
                    <li key={i} className="flex items-start gap-4 px-4 py-3">
                      <span className="w-24 shrink-0 text-xs font-medium text-zinc-500 tabular">{formatDate(job.created_at)}</span>
                      <p className="min-w-0 flex-1 text-sm text-zinc-900">{job.description}</p>
                      <Badge color={JOB_STATUS_COLOR[job.status]} dot>
                        {job.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {result.appointments.length > 0 && (
              <Card className="overflow-hidden">
                <div className="border-b border-zinc-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-zinc-900">Appointments</h2>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {result.appointments.map((apt, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{formatDateTime(apt.scheduled_at)}</p>
                        {apt.notes && <p className="text-xs text-zinc-500">{apt.notes}</p>}
                      </div>
                      <Badge color={APT_STATUS_COLOR[apt.status]}>{apt.status}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
