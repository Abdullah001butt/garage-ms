import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/types";
import { createAppointment, updateAppointmentStatus, rescheduleAppointment, deleteAppointment } from "@/app/appointments/actions";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton, labelClass, inputClass } from "@/components/ui";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { SlideOver } from "@/components/SlideOver";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  notes: string | null;
  status: AppointmentStatus;
  booked_online: boolean;
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

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: newParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: appointments, error }, { data: customers }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, scheduled_at, notes, status, booked_online, customers(name, phone), vehicles(plate_number)")
      .order("scheduled_at", { ascending: true })
      .returns<AppointmentRow[]>(),
    supabase
      .from("customers")
      .select("id, name, vehicles(id, plate_number)")
      .order("name")
      .returns<CustomerVehicleOption[]>(),
  ]);

  return (
    <div className="page">
      <PageHeader
        title="Appointments"
        description="Upcoming and past service bookings."
        action={
          <SlideOver title="Book an appointment" description="Pick the customer and vehicle, then a date and time." triggerLabel="New Appointment" defaultOpen={newParam === "1"}>
        <form action={createAppointment} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block col-span-full">
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
          <label className="block col-span-full">
            <span className={labelClass}>Notes</span>
            <input type="text" name="notes" className={inputClass} />
          </label>
          <div className="col-span-full">
            <PrimaryButton type="submit">Book Appointment</PrimaryButton>
          </div>
        </form>
          </SlideOver>
        }
      />

      {error && (
        <p className="text-red-600 text-sm mb-4">Failed to load appointments: {error.message}</p>
      )}

      {(() => {
        const groups = new Map<string, AppointmentRow[]>();
        for (const apt of appointments ?? []) {
          const dayKey = new Date(apt.scheduled_at).toDateString();
          const arr = groups.get(dayKey) ?? [];
          arr.push(apt);
          groups.set(dayKey, arr);
        }
        const todayKey = new Date().toDateString();
        return (
          <div className="mb-8 space-y-4">
            {[...groups.entries()].map(([dayKey, apts]) => (
              <div key={dayKey}>
                <p className="mb-2 text-xs font-medium text-zinc-500">
                  {dayKey === todayKey ? "Today" : new Date(dayKey).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </p>
                <Card className="overflow-hidden">
                  <ul className="divide-y divide-zinc-100">
                    {apts.map((apt) => (
                      <li key={apt.id} className="relative flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <div>
                          <p className="font-medium text-zinc-900">
                            {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} —{" "}
                            {apt.customers?.name}
                            {apt.booked_online && (
                              <Badge color="blue" className="ml-2">
                                Online
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {apt.vehicles?.plate_number ?? "No vehicle specified"}
                            {apt.notes ? ` · ${apt.notes}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge color={STATUS_COLOR[apt.status]}>{apt.status}</Badge>
                          {apt.status === "scheduled" && apt.customers?.phone && (
                            <a
                              href={buildWhatsAppLink(
                                apt.customers.phone,
                                `Hi ${apt.customers.name.split(" ")[0]}, this is a reminder of your appointment at Al Bahir Garage on ${new Date(
                                  apt.scheduled_at
                                ).toLocaleString()}${apt.vehicles?.plate_number ? ` for ${apt.vehicles.plate_number}` : ""}.`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                            >
                              Remind
                            </a>
                          )}
                          {apt.status === "scheduled" && (
                            <>
                              <form action={updateAppointmentStatus.bind(null, apt.id, "completed")}>
                                <button className="text-xs font-medium text-zinc-600 hover:text-zinc-900">Complete</button>
                              </form>
                              <details className="inline-block">
                                <summary className="cursor-pointer list-none text-xs font-medium text-zinc-600 hover:text-zinc-900">
                                  Reschedule
                                </summary>
                                <form
                                  action={rescheduleAppointment.bind(null, apt.id)}
                                  className="absolute z-10 mt-1 flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-3 shadow-md"
                                >
                                  <input
                                    type="date"
                                    name="date"
                                    required
                                    defaultValue={new Date(apt.scheduled_at).toISOString().slice(0, 10)}
                                    className="rounded border border-zinc-300 px-2 py-1 text-xs"
                                  />
                                  <input
                                    type="time"
                                    name="time"
                                    required
                                    defaultValue={new Date(apt.scheduled_at).toTimeString().slice(0, 5)}
                                    className="rounded border border-zinc-300 px-2 py-1 text-xs"
                                  />
                                  <input
                                    type="text"
                                    name="notes"
                                    defaultValue={apt.notes ?? ""}
                                    placeholder="Notes"
                                    className="rounded border border-zinc-300 px-2 py-1 text-xs"
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-md border border-zinc-300 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-zinc-50 px-2 py-1 text-xs font-medium"
                                  >
                                    Save
                                  </button>
                                </form>
                              </details>
                              <form action={updateAppointmentStatus.bind(null, apt.id, "cancelled")}>
                                <button className="text-xs font-medium text-zinc-500 hover:text-red-600">Cancel</button>
                              </form>
                            </>
                          )}
                          <ConfirmSubmitButton
                            action={deleteAppointment.bind(null, apt.id)}
                            confirmMessage="Delete this appointment? This cannot be undone."
                            successMessage="Appointment deleted."
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            ))}
            {(appointments?.length ?? 0) === 0 && (
              <Card>
                <EmptyState message="No appointments yet." />
              </Card>
            )}
          </div>
        );
      })()}

    </div>
  );
}
