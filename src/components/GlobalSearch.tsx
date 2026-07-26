"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/app/api/search/route";

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  customer: "Customers",
  vehicle: "Vehicles",
  job: "Job Cards",
};

const TYPE_ICON: Record<SearchResult["type"], string> = {
  customer: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-2.13a4 4 0 100-8 4 4 0 000 8zm7-3a3 3 0 11-6 0 3 3 0 016 0z",
  vehicle: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  job: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
};

function resultHref(r: SearchResult) {
  if (r.type === "customer") return `/customers/${r.id}`;
  if (r.type === "vehicle") return `/customers/${r.customerId}`;
  return `/jobs/${r.id}`;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setActiveIndex(0);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  const navigateTo = useCallback(
    (r: SearchResult) => {
      router.push(resultHref(r));
      setOpen(false);
    },
    [router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      navigateTo(results[activeIndex]);
    }
  }

  const grouped = (["customer", "vehicle", "job"] as const)
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  let flatIndex = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-500"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-left">Search customers, plates, jobs...</span>
        <kbd className="ml-auto hidden sm:inline text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] print:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-0 sm:top-20 mx-auto w-full sm:max-w-lg px-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search customers, plates, jobs..."
                  className="flex-1 text-sm outline-none placeholder:text-slate-400"
                />
                <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
                  Esc
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading && <p className="px-4 py-6 text-sm text-slate-400 text-center">Searching...</p>}
                {!loading && query.trim().length >= 2 && results.length === 0 && (
                  <p className="px-4 py-6 text-sm text-slate-400 text-center">No matches found.</p>
                )}
                {!loading && query.trim().length < 2 && (
                  <p className="px-4 py-6 text-sm text-slate-400 text-center">
                    Type at least 2 characters — customer name, phone, plate number, or job description.
                  </p>
                )}
                {grouped.map((group) => (
                  <div key={group.type} className="py-2">
                    <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {TYPE_LABEL[group.type]}
                    </p>
                    {group.items.map((r) => {
                      flatIndex++;
                      const idx = flatIndex;
                      return (
                        <button
                          key={`${r.type}-${r.id}`}
                          type="button"
                          onClick={() => navigateTo(r)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                            idx === activeIndex ? "bg-indigo-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICON[r.type]} />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{r.title}</p>
                            <p className="text-xs text-slate-500 truncate">{r.subtitle}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
