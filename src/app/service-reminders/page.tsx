import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getServiceDueVehicles, type ServiceDueVehicle } from "@/lib/service-due";
import { Card, PageHeader, Badge, EmptyState, SegmentedLinks, theadClass, thClass } from "@/components/ui";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { PlateBadge } from "@/components/PlateBadge";
import { RowMenu, RowMenuLink } from "@/components/RowMenu";

function reminderMessage(v: ServiceDueVehicle) {
  const vehicle = [v.make, v.model].filter(Boolean).join(" ") || "vehicle";
  return v.status === "overdue"
    ? `Hi ${v.customerName.split(" ")[0]}, your ${vehicle} (${v.plateNumber}) is due for service at Al Bahir Garage. Would you like to book a time?`
    : `Hi ${v.customerName.split(" ")[0]}, your ${vehicle} (${v.plateNumber}) will be due for service soon. Would you like to book a time at Al Bahir Garage?`;
}

export default async function ServiceRemindersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const vehicles = await getServiceDueVehicles();
  const overdue = vehicles.filter((v) => v.status === "overdue");
  const dueSoon = vehicles.filter((v) => v.status === "due_soon");
  const rows = filter === "overdue" ? overdue : filter === "soon" ? dueSoon : vehicles;
  const nowMs = new Date().getTime();

  return (
    <div className="page">
      <PageHeader title="Service Reminders" description="Vehicles overdue or due within 14 days, based on time since their last completed service." />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <Card className="p-4">
          <p className="text-[13px] font-medium text-zinc-500">Overdue</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-red-700 tabular">{overdue.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] font-medium text-zinc-500">Due in 14 days</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-amber-700 tabular">{dueSoon.length}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-zinc-200 p-3">
          <SegmentedLinks
            items={[
              { label: `All (${vehicles.length})`, href: "/service-reminders", active: !filter },
              { label: `Overdue (${overdue.length})`, href: "/service-reminders?filter=overdue", active: filter === "overdue" },
              { label: `Due soon (${dueSoon.length})`, href: "/service-reminders?filter=soon", active: filter === "soon" },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className={thClass}>Vehicle</th>
                <th className={`${thClass} hidden md:table-cell`}>Customer</th>
                <th className={`${thClass} hidden sm:table-cell`}>Last service</th>
                <th className={thClass}>Due</th>
                <th className="w-px" />
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const daysOverdue = Math.round((nowMs - v.dueAt.getTime()) / 86400000);
                return (
                  <tr key={v.vehicleId} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/vehicles/${v.vehicleId}/passport`} className="flex items-center gap-3">
                        <PlateBadge plateNumber={v.plateNumber} emirate={v.emirate} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900">{[v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}</span>
                          <span className="block truncate text-xs text-zinc-500 md:hidden">{v.customerName}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <Link href={`/customers/${v.customerId}`} className="text-zinc-700 hover:underline">
                        {v.customerName}
                      </Link>
                      <p className="text-xs text-zinc-500 tabular">{v.customerPhone}</p>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-500 tabular sm:table-cell">{formatDate(v.lastServiceAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {v.status === "overdue" ? (
                        <Badge color="red" dot>
                          {daysOverdue}d overdue
                        </Badge>
                      ) : (
                        <Badge color="amber" dot>
                          Due {formatDate(v.dueAt)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <WhatsAppButton phone={v.customerPhone} label="Remind" size="sm" message={reminderMessage(v)} />
                        <RowMenu>
                          <RowMenuLink href={`/vehicles/${v.vehicleId}/passport`} icon="car">
                            Vehicle passport
                          </RowMenuLink>
                          <RowMenuLink href={`/customers/${v.customerId}`} icon="user">
                            Open customer
                          </RowMenuLink>
                          <RowMenuLink href="/appointments?new=1" icon="calendar">
                            Book appointment
                          </RowMenuLink>
                        </RowMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <EmptyState icon="check-circle" message={vehicles.length === 0 ? "No vehicles are due for service. All caught up." : "Nothing in this view."} />}
      </Card>
    </div>
  );
}
