"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { SearchResult } from "@/app/api/search/route";
import type { Role } from "@/lib/types";
import { NAV_GROUPS } from "@/lib/nav-data";
import { Icon, type IconName } from "@/components/icons";

type PaletteItem = {
  key: string;
  group: "Actions" | "Go to" | "Customers" | "Vehicles" | "Job Cards";
  label: string;
  sublabel?: string;
  href: string;
  icon?: IconName;
  navIcon?: string;
  keywords?: string;
};

const ACTIONS: (PaletteItem & { ownerOnly?: boolean })[] = [
  { key: "a-job", group: "Actions", label: "New job card", href: "/jobs/new", icon: "wrench", keywords: "create job check in vehicle" },
  { key: "a-customer", group: "Actions", label: "Add customer", href: "/customers/new", icon: "user", keywords: "create new client company" },
  { key: "a-estimate", group: "Actions", label: "New estimate", href: "/estimates/new", icon: "file", keywords: "quote quotation", ownerOnly: true },
  { key: "a-appointment", group: "Actions", label: "Book appointment", href: "/appointments?new=1", icon: "calendar", keywords: "schedule booking" },
  { key: "a-evaluation", group: "Actions", label: "New vehicle evaluation", href: "/evaluations/new", icon: "check-circle", keywords: "valuation report inspection" },
  { key: "a-expense", group: "Actions", label: "Record expense", href: "/expenses?new=1", icon: "wallet", keywords: "cost spend bill", ownerOnly: true },
  { key: "a-report", group: "Actions", label: "Build a report", href: "/reports/builder", icon: "trending", keywords: "export excel filter", ownerOnly: true },
];

const RECORD_GROUP: Record<SearchResult["type"], PaletteItem["group"]> = {
  customer: "Customers",
  vehicle: "Vehicles",
  job: "Job Cards",
};
const RECORD_ICON: Record<SearchResult["type"], IconName> = { customer: "user", vehicle: "car", job: "wrench" };

function resultHref(r: SearchResult) {
  if (r.type === "customer") return `/customers/${r.id}`;
  if (r.type === "vehicle") return `/customers/${r.customerId}`;
  return `/jobs/${r.id}`;
}

function matches(item: { label: string; keywords?: string }, q: string) {
  if (!q) return true;
  const hay = `${item.label} ${item.keywords ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word));
}

export function GlobalSearch({ role = null }: { role?: Role | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isOwner = role === "owner";

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 180);
    return () => clearTimeout(handle);
  }, [query]);

  const trimmed = debouncedQuery.trim();
  const q = query.trim();

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", trimmed],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal });
      const json = await res.json();
      return (json.results ?? []) as SearchResult[];
    },
    enabled: open && trimmed.length >= 2,
    staleTime: 60_000,
  });

  const items = useMemo<PaletteItem[]>(() => {
    const actions = ACTIONS.filter((a) => (!a.ownerOnly || isOwner) && matches(a, q));
    const pages: PaletteItem[] = q
      ? NAV_GROUPS.filter((g) => !g.ownerOnly || isOwner)
          .flatMap((g) => g.items.map((i) => ({ ...i, groupLabel: g.label })))
          .filter((i) => matches({ label: i.label, keywords: i.groupLabel }, q))
          .map((i) => ({ key: `p-${i.href}`, group: "Go to", label: i.label, sublabel: i.groupLabel, href: i.href, navIcon: i.icon }))
      : [];
    const records: PaletteItem[] =
      trimmed.length >= 2
        ? (data ?? []).map((r) => ({
            key: `r-${r.type}-${r.id}`,
            group: RECORD_GROUP[r.type],
            label: r.title,
            sublabel: r.subtitle,
            href: resultHref(r),
            icon: RECORD_ICON[r.type],
          }))
        : [];
    return [...actions.slice(0, q ? 4 : ACTIONS.length), ...pages.slice(0, 5), ...records];
  }, [q, trimmed, data, isOwner]);

  const safeIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  function close() {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setActiveIndex(0);
  }

  function go(item: PaletteItem) {
    router.push(item.href);
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[safeIndex]) {
      e.preventDefault();
      go(items[safeIndex]);
    }
  }

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [safeIndex]);

  const groups = items.reduce<{ group: string; items: { item: PaletteItem; index: number }[] }[]>((acc, item, index) => {
    const last = acc[acc.length - 1];
    if (last && last.group === item.group) last.items.push({ item, index });
    else acc.push({ group: item.group, items: [{ item, index }] });
    return acc;
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 w-full items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-[13px] text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-white"
      >
        <Icon name="search" className="h-4 w-4" />
        <span className="min-w-0 flex-1 truncate text-left">Search or jump to…</span>
        <kbd className="ml-auto hidden rounded border border-zinc-200 bg-white px-1.5 py-px font-sans text-[11px] text-zinc-400 sm:inline">Ctrl K</kbd>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-60 print:hidden">
            <div className="absolute inset-0 bg-zinc-950/30" onClick={close} />
            <div className="absolute inset-x-0 top-0 mx-auto w-full px-3 pt-3 sm:top-[12vh] sm:max-w-xl sm:pt-0">
              <div className="pop-in overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
                <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4">
                  <Icon name="search" className="h-4 w-4 text-zinc-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search customers, plates, jobs — or type a command"
                    className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                  />
                  {isFetching && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />}
                </div>

                <div ref={listRef} className="max-h-[min(60vh,26rem)] overflow-y-auto p-1.5">
                  {groups.map((g) => (
                    <div key={g.group} className="mb-1">
                      <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{g.group}</p>
                      {g.items.map(({ item, index }) => {
                        const active = index === safeIndex;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            data-active={active}
                            onClick={() => go(item)}
                            onMouseMove={() => setActiveIndex(index)}
                            className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left ${active ? "bg-zinc-100" : ""}`}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500">
                              {item.icon ? (
                                <Icon name={item.icon} className="h-3.5 w-3.5" />
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d={item.navIcon} />
                                </svg>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-zinc-900">{item.label}</span>
                              {item.sublabel && <span className="block truncate text-xs text-zinc-500">{item.sublabel}</span>}
                            </span>
                            {active && <Icon name="arrow-right" className="h-3.5 w-3.5 text-zinc-400" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-zinc-400">
                      {isFetching ? "Searching…" : `No results for “${q}”.`}
                    </p>
                  )}
                </div>

                <div className="hidden items-center gap-4 border-t border-zinc-100 bg-zinc-50/80 px-4 py-2 text-[11px] text-zinc-500 sm:flex">
                  <span>
                    <kbd className="rounded border border-zinc-200 bg-white px-1 font-sans">↑</kbd>{" "}
                    <kbd className="rounded border border-zinc-200 bg-white px-1 font-sans">↓</kbd> to navigate
                  </span>
                  <span>
                    <kbd className="rounded border border-zinc-200 bg-white px-1 font-sans">Enter</kbd> to open
                  </span>
                  <span>
                    <kbd className="rounded border border-zinc-200 bg-white px-1 font-sans">Esc</kbd> to close
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
