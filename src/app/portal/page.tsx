import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge } from "@/components/ui";

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

type PortalResult = {
  customer_name: string;
  vehicle: { plate_number: string; make: string | null; model: string | null; year: number | null };
  jobs: PortalJob[];
  appointments: PortalAppointment[];
};

const JOB_STATUS_COLOR: Record<string, "gray" | "amber" | "green"> = {
  pending: "gray",
  in_progress: "amber",
  completed: "green",
};

const APT_STATUS_COLOR: Record<string, "blue" | "green" | "gray"> = {
  scheduled: "blue",
  completed: "green",
  cancelled: "gray",
};

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; plate?: string }>;
}) {
  const { phone, plate } = await searchParams;
  const searched = Boolean(phone && plate);

  let result: PortalResult | null = null;
  let queryError: string | null = null;

  if (searched) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("portal_lookup", {
      p_phone: phone,
      p_plate: plate,
    });

    if (error) {
      queryError = error.message;
    } else {
      result = data as PortalResult | null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={320} height={68} className="h-16 w-auto object-contain mb-2" priority />
          <p className="text-sm text-slate-500">Check your vehicle&apos;s service status</p>
        </div>

        <Card className="p-5 mb-6">
          <form className="grid grid-cols-2 gap-4">
            <label className="block col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">Phone number</span>
              <input
                type="text"
                name="phone"
                defaultValue={phone ?? ""}
                required
                placeholder="e.g. 0501234567"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="block col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">Plate number</span>
              <input
                type="text"
                name="plate"
                defaultValue={plate ?? ""}
                required
                placeholder="e.g. DXB-12345"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <button
              type="submit"
              className="col-span-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
            >
              Check Status
            </button>
          </form>
        </Card>

        {queryError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
            {queryError}
          </p>
        )}

        {searched && !queryError && !result && (
          <Card className="p-5 text-center text-sm text-slate-500">
            No match found. Double-check your phone number and plate number.
          </Card>
        )}

        {result && (
          <div className="space-y-6">
            <Card className="p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Vehicle</p>
              <p className="font-semibold text-slate-900">
                {result.vehicle.plate_number}
                {result.vehicle.make || result.vehicle.model
                  ? ` — ${[result.vehicle.make, result.vehicle.model].filter(Boolean).join(" ")}`
                  : ""}
              </p>
              <p className="text-sm text-slate-500">{result.customer_name}</p>
            </Card>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Service History</h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-slate-100">
                  {result.jobs.map((job, i) => (
                    <li key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{job.description}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(job.created_at).toLocaleDateString()}
                          {job.mechanic_name ? ` · ${job.mechanic_name}` : ""}
                        </p>
                      </div>
                      <Badge color={JOB_STATUS_COLOR[job.status]}>{job.status.replace("_", " ")}</Badge>
                    </li>
                  ))}
                  {result.jobs.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-slate-400">
                      No service records yet.
                    </li>
                  )}
                </ul>
              </Card>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Appointments</h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-slate-100">
                  {result.appointments.map((apt, i) => (
                    <li key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {new Date(apt.scheduled_at).toLocaleString()}
                        </p>
                        {apt.notes && <p className="text-xs text-slate-500">{apt.notes}</p>}
                      </div>
                      <Badge color={APT_STATUS_COLOR[apt.status]}>{apt.status}</Badge>
                    </li>
                  ))}
                  {result.appointments.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-slate-400">
                      No appointments on file.
                    </li>
                  )}
                </ul>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
