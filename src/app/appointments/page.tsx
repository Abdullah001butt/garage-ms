import Link from "next/link";
import { formatDateTime, formatTime, formatWeekdayDate, dayKey as toDayKey, uaeInputValues } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/types";
import { createAppointment, updateAppointmentStatus, rescheduleAppointment, deleteAppointment } from "@/app/appointments/actions";
import { Card, PageHeader, Badge, EmptyState, PrimaryButton, labelClass, inputClass } from "@/components/ui";
import { SlideOver } from "@/components/SlideOver";
import { RowMenu, RowMenuAction, RowMenuDelete, RowMenuSeparator } from "@/components/RowMenu";
import { WhatsAppButton } from "@/components/WhatsAppButton";

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
          const dayKey = toDayKey(apt.scheduled_at);
          const arr = groups.get(dayKey) ?? [];
          arr.push(apt);
          groups.set(dayKey, arr);
        }
        const todayKey = toDayKey(new Date());
        return (
          <div className="mb-8 space-y-4">
            {[...groups.entries()].map(([dayKey, apts]) => (
              <div key={dayKey}>
                <p className="mb-2 text-xs font-medium text-zinc-500">
                  {dayKey === todayKey ? "Today" : formatWeekdayDate(dayKey)}
                </p>
                <Card>
                  <ul className="divide-y divide-zinc-100">
                    {apts.map((apt) => (
                      <li key={apt.id} className="relative flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                        <span className="w-20 shrink-0 text-sm font-semibold text-zinc-900 tabular">{formatTime(apt.scheduled_at)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate font-medium text-zinc-900">
                            {apt.customers?.name}
                            {apt.booked_online && <Badge color="blue">Online</Badge>}
                          </p>
                          <p className="truncate text-sm text-zinc-500">
                            {apt.vehicles?.plate_number ?? "No vehicle specified"}
                            {apt.notes ? ` · ${apt.notes}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge color={STATUS_COLOR[apt.status]} dot>
                            {apt.status}
                          </Badge>
                          {apt.status === "scheduled" && apt.customers?.phone && (
                            <WhatsAppButton
                              size="sm"
                              label="Remind"
                              phone={apt.customers.phone}
                              message={`Hi ${apt.customers.name.split(" ")[0]}, this is a reminder of your appointment at Al Bahir Garage on ${formatDateTime(apt.scheduled_at)}${apt.vehicles?.plate_number ? ` for ${apt.vehicles.plate_number}` : ""}.`}
                            />
                          )}
                          {apt.status === "scheduled" && (
                            <details className="relative">
                              <summary className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50">
                                Reschedule
                              </summary>
                              <form
                                action={rescheduleAppointment.bind(null, apt.id)}
                                className="absolute right-0 z-20 mt-1 grid w-64 gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg"
                              >
                                <input type="date" name="date" required defaultValue={uaeInputValues(apt.scheduled_at).date} className={inputClass} />
                                <input type="time" name="time" required defaultValue={uaeInputValues(apt.scheduled_at).time} className={inputClass} />
                                <input type="text" name="notes" defaultValue={apt.notes ?? ""} placeholder="Notes" className={inputClass} />
                                <PrimaryButton type="submit">Save new time</PrimaryButton>
                              </form>
                            </details>
                          )}
                          <RowMenu>
                            {apt.status === "scheduled" && (
                              <>
                                <RowMenuAction
                                  action={updateAppointmentStatus.bind(null, apt.id, "completed")}
                                  icon="check-circle"
                                  successMessage="Marked as completed."
                                >
                                  Mark completed
                                </RowMenuAction>
                                <RowMenuAction
                                  action={updateAppointmentStatus.bind(null, apt.id, "cancelled")}
                                  icon="x"
                                  successMessage="Appointment cancelled."
                                >
                                  Cancel appointment
                                </RowMenuAction>
                                <RowMenuSeparator />
                              </>
                            )}
                            <RowMenuDelete
                              action={deleteAppointment.bind(null, apt.id)}
                              confirmMessage="Delete this appointment?"
                              successMessage="Appointment deleted."
                            />
                          </RowMenu>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            ))}
            {(appointments?.length ?? 0) === 0 && (
              <Card>
                <EmptyState icon="calendar" title="No appointments yet" message="Book customers in, or share your online booking link so they can request a time themselves." action={<><Link href="/appointments?new=1" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:bg-brand-700">+ Book appointment</Link><Link href="/settings" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50">Get booking link</Link></>} />
              </Card>
            )}
          </div>
        );
      })()}

    </div>
  );
}
