"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavGroup } from "@/lib/nav-data";
import type { NavCount } from "@/app/api/nav-counts/route";
import { NAV_COUNTS_REFRESH } from "@/lib/nav-events";

const TONE: Record<NavCount["tone"], string> = {
  neutral: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
};


let cache: Record<string, NavCount> = {};

function useNavCounts(pathname: string) {
  const [counts, setCounts] = useState<Record<string, NavCount>>(cache);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/nav-counts", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) {
            cache = d;
            setCounts(d);
          }
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 45000);
    const onFocus = () => document.visibilityState === "visible" && load();
    const onRefresh = () => setTimeout(load, 400);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener(NAV_COUNTS_REFRESH, onRefresh);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener(NAV_COUNTS_REFRESH, onRefresh);
    };
  }, [pathname]);
  return counts;
}

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Shared navigation list for the desktop sidebar and the mobile drawer, with
// a clear active state so you always know which page you're on.
export function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const counts = useNavCounts(pathname);
  // The most specific match wins, so /staff/salaries highlights "Salaries", not "Staff".
  const activeHref = groups
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((href) => matches(pathname, href))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{group.label}</p>
          <div className="space-y-px">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors ${
                    active ? "bg-zinc-100 font-semibold text-zinc-900" : "font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
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
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {counts[item.href] && (
                    <span
                      key={counts[item.href].count}
                      title={counts[item.href].title}
                      className={`count-pop ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular ring-1 ring-inset ${TONE[counts[item.href].tone]}`}
                    >
                      {counts[item.href].count > 99 ? "99+" : counts[item.href].count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
