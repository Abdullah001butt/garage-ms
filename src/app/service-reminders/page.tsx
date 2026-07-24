import Link from "next/link";
import { getServiceDueVehicles } from "@/lib/service-due";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export default async function ServiceRemindersPage() {
  const vehicles = await getServiceDueVehicles();
  const overdue = vehicles.filter((v) => v.status === "overdue");
  const dueSoon = vehicles.filter((v) => v.status === "due_soon");

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Service Reminders"
        description="Vehicles overdue or coming up for their next service, based on time since last visit."
      />

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-red-700 mb-2">Overdue {overdue.length > 0 && `(${overdue.length})`}</h2>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {overdue.map((v) => (
              <li key={v.vehicleId} className="px-4 py-3 flex items-center justify-between gap-3">
                <Link href={`/customers`} className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {v.plateNumber} — {[v.make, v.model].filter(Boolean).join(" ")}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {v.customerName} · Last serviced {v.lastServiceAt.toLocaleDateString()}
                  </p>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge color="red">
                    {Math.round((Date.now() - v.dueAt.getTime()) / 86400000)}d overdue
                  </Badge>
                  <WhatsAppButton
                    phone={v.customerPhone}
                    label="Remind"
                    message={`Hi ${v.customerName.split(" ")[0]}, your ${[v.make, v.model].filter(Boolean).join(" ") || "vehicle"} (${v.plateNumber}) is due for service at Al Bahir Garage. Would you like to book a time?`}
                  />
                </div>
              </li>
            ))}
          </ul>
          {overdue.length === 0 && <EmptyState message="No overdue vehicles." />}
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-amber-700 mb-2">
          Due Soon (next 14 days) {dueSoon.length > 0 && `(${dueSoon.length})`}
        </h2>
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {dueSoon.map((v) => (
              <li key={v.vehicleId} className="px-4 py-3 flex items-center justify-between gap-3">
                <Link href={`/customers`} className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {v.plateNumber} — {[v.make, v.model].filter(Boolean).join(" ")}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {v.customerName} · Due {v.dueAt.toLocaleDateString()}
                  </p>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge color="amber">Due {v.dueAt.toLocaleDateString()}</Badge>
                  <WhatsAppButton
                    phone={v.customerPhone}
                    label="Remind"
                    message={`Hi ${v.customerName.split(" ")[0]}, your ${[v.make, v.model].filter(Boolean).join(" ") || "vehicle"} (${v.plateNumber}) will be due for service soon. Would you like to book a time at Al Bahir Garage?`}
                  />
                </div>
              </li>
            ))}
          </ul>
          {dueSoon.length === 0 && <EmptyState message="Nothing due in the next 14 days." />}
        </Card>
      </div>
    </div>
  );
}
