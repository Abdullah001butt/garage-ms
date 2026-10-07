"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/nav-data";

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Shared navigation list for the desktop sidebar and the mobile drawer, with
// a clear active state so you always know which page you're on.
export function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  // The most specific match wins, so /staff/salaries highlights "Salaries", not "Staff".
  const activeHref = groups
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((href) => matches(pathname, href))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2.5 mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{group.label}</p>
          <div className="space-y-px">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                    active ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-0.5 rounded-r bg-brand-600" />}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 shrink-0 ${active ? "text-brand-600" : "text-zinc-400 group-hover:text-zinc-600"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
