import Link from "next/link";
import Image from "next/image";
import type { Role } from "@/lib/types";

const NAV_GROUPS: {
  label: string;
  ownerOnly?: boolean;
  items: { href: string; label: string; icon: string }[];
}[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z" }],
  },
  {
    label: "Operations",
    items: [
      { href: "/customers", label: "Customers", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-2.13a4 4 0 100-8 4 4 0 000 8zm7-3a3 3 0 11-6 0 3 3 0 016 0z" },
      { href: "/jobs", label: "Job Cards", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
      { href: "/appointments", label: "Appointments", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    ],
  },
  {
    label: "Billing & Finance",
    ownerOnly: true,
    items: [
      { href: "/estimates", label: "Estimates", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { href: "/invoices", label: "Invoices", icon: "M9 14l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
      { href: "/expenses", label: "Expenses", icon: "M17 9V7a4 4 0 00-8 0v2M5 9h14l1 12H4L5 9z" },
      { href: "/reports/vat", label: "VAT Report", icon: "M9 17v-6h6v6m-9 4h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" },
      { href: "/reports/daily-cashflow", label: "Daily Cash Flow", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { href: "/partners", label: "Partners", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-2.13a4 4 0 100-8 4 4 0 000 8zm7-3a3 3 0 11-6 0 3 3 0 016 0z" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/inventory", label: "Parts Stock", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
      { href: "/purchase-orders", label: "Purchase Orders", icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" },
    ],
  },
  {
    label: "Settings",
    ownerOnly: true,
    items: [
      { href: "/settings", label: "Shop Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" },
      { href: "/staff", label: "Staff", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-2.13a4 4 0 100-8 4 4 0 000 8zm7-3a3 3 0 11-6 0 3 3 0 016 0z" },
    ],
  },
];

export function Sidebar({ role }: { role: Role | null }) {
  const isOwner = role === "owner";
  const groups = NAV_GROUPS.filter((g) => !g.ownerOnly || isOwner);
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 print:hidden">
      <div className="flex items-center justify-center h-20 border-b border-slate-800 px-5">
        <div className="rounded-lg bg-white p-2">
          <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={220} height={48} className="h-10 w-auto object-contain" priority />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
