import Link from "next/link";
import { Card } from "@/components/ui";

const MODULES = [
  { href: "/dashboard", title: "Dashboard", description: "Performance and financial overview." },
  { href: "/customers", title: "Customers & Vehicles", description: "Manage customer records and their vehicles." },
  { href: "/jobs", title: "Job Cards", description: "Track vehicles in for service and their status." },
  { href: "/estimates", title: "Estimates", description: "Quote jobs before they're approved." },
  { href: "/invoices", title: "Invoices", description: "Tax-compliant invoices with VAT." },
  { href: "/inventory", title: "Parts Stock", description: "Live inventory levels and reorder alerts." },
  { href: "/purchase-orders", title: "Purchase Orders", description: "Reorder fast-moving parts automatically." },
  { href: "/appointments", title: "Appointments", description: "Book and manage upcoming service appointments." },
  { href: "/expenses", title: "Expenses", description: "Track shop running costs." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Al Bahir Garage</h1>
      <p className="text-slate-500 mb-8">Garage management system</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((mod) => (
          <Link key={mod.href} href={mod.href}>
            <Card className="p-5 h-full hover:border-indigo-300 hover:shadow-md transition">
              <h2 className="font-semibold text-slate-900 mb-1">{mod.title}</h2>
              <p className="text-sm text-slate-500">{mod.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
