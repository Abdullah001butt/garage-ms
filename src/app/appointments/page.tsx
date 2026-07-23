import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/types";
import { createAppointment, updateAppointmentStatus } from "@/app/appointments/actions";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton, labelClass, inputClass } from "@/components/ui";

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  notes: string | null;
  status: AppointmentStatus;
  customers: { name: string; phone: string } | null;
  vehicles: { plate_number: string } | null;
};

type CustomerVehicleOption = {
  id: string;
  name: string;
  vehicles: { id: string; plate_number: string }[];
};

const STATUS_COLOR: Record<AppointmentStatus, "blue" | "green" | "gray"> = {
  scheduled: "blue",
  completed: "green",
  cancelled: "gray",
};

export default async function AppointmentsPage() {
  const supabase = await createClient();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, scheduled_at, notes, status, customers(name, phone), vehicles(plate_number)")
    .order("scheduled_at", { ascending: true })
    .returns<AppointmentRow[]>();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, vehicles(id, plate_number)")
    .order("name")
    .returns<CustomerVehicleOption[]>();

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title="Appointments" description="Upcoming and past service bookings." />

      {error && (
        <p className="text-red-600 text-sm mb-4">Failed to load appointments: {error.message}</p>
      )}

      <Card className="mb-8 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {appointments?.map((apt) => (
            <li key={apt.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">
                  {new Date(apt.scheduled_at).toLocaleString()} — {apt.customers?.name}
                </p>
                <p className="text-sm text-slate-500">
                  {apt.vehicles?.plate_number ?? "No vehicle specified"}
                  {apt.notes ? ` · ${apt.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge color={STATUS_COLOR[apt.status]}>{apt.status}</Badge>
                {apt.status === "scheduled" && (
                  <>
                    <form action={updateAppointmentStatus.bind(null, apt.id, "completed")}>
                      <button className="text-xs text-emerald-700 hover:underline">Complete</button>
                    </form>
                    <form action={updateAppointmentStatus.bind(null, apt.id, "cancelled")}>
                      <button className="text-xs text-red-600 hover:underline">Cancel</button>
                    </form>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        {appointments?.length === 0 && <EmptyState message="No appointments yet." />}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-700 mb-4">Book an appointment</p>
        <form action={createAppointment} className="grid grid-cols-2 gap-4">
          <label className="block col-span-2">
            <span className={labelClass}>
              Customer / Vehicle <span className="text-red-500">*</span>
            </span>
            <select name="customer_vehicle" required className={inputClass}>
              <option value="">Select...</option>
              {customers?.map((c) =>
                c.vehicles.length > 0 ? (
                  c.vehicles.map((v) => (
                    <option key={v.id} value={`${c.id}::${v.id}`}>
                      {c.name} — {v.plate_number}
                    </option>
                  ))
                ) : (
                  <option key={c.id} value={`${c.id}::`}>
                    {c.name} (no vehicle)
                  </option>
                )
              )}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Date</span>
            <input type="date" name="date" required className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Time</span>
            <input type="time" name="time" required className={inputClass} />
          </label>
          <label className="block col-span-2">
            <span className={labelClass}>Notes</span>
            <input type="text" name="notes" className={inputClass} />
          </label>
          <div className="col-span-2">
            <PrimaryButton type="submit">Book Appointment</PrimaryButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
