"use client";

import { useMemo, useState } from "react";
import type { Part } from "@/lib/types";
import { inputClass, labelClass } from "@/components/ui";
import { PrimaryButton } from "@/components/ui-buttons";
import { Icon } from "@/components/icons";
import { BarcodeScanner } from "@/components/BarcodeScanner";

type Line = { key: string; part_id: string | null; description: string; quantity: number; unit_price: string; stock: number | null };

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Transfer" },
  { value: "ziina", label: "Ziina" },
];

const money = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CounterSaleForm({
  parts,
  vatRate,
  action,
}: {
  parts: Pick<Part, "id" | "name" | "sku" | "stock_qty" | "unit_price">[];
  vatRate: number;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState("cash");
  const [showCustomer, setShowCustomer] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? parts.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)) : parts;
    return list.slice(0, 12);
  }, [parts, query]);

  const subtotal = lines.reduce((s, l) => s + l.quantity * (Number(l.unit_price) || 0), 0);
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;
  const ready = lines.length > 0 && lines.every((l) => l.description.trim() && l.quantity > 0 && l.unit_price !== "");

  function addPart(part: (typeof parts)[number]) {
    setNotice(null);
    setLines((current) => {
      const existing = current.find((l) => l.part_id === part.id);
      if (existing) return current.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...current,
        { key: part.id, part_id: part.id, description: part.name, quantity: 1, unit_price: String(part.unit_price ?? ""), stock: part.stock_qty },
      ];
    });
  }

  function addCustom() {
    setLines((current) => [...current, { key: `c${Date.now()}`, part_id: null, description: "", quantity: 1, unit_price: "", stock: null }]);
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onScan(text: string) {
    setScanning(false);
    const part = parts.find((p) => p.sku && p.sku.toLowerCase() === text.trim().toLowerCase());
    if (part) addPart(part);
    else setNotice(`No part with barcode / SKU "${text.trim()}".`);
  }

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ ...l, unit_price: Number(l.unit_price) || 0 })))} />
      <input type="hidden" name="method" value={method} />

      {/* Left: pick items */}
      <div className="min-w-0 rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex gap-2 border-b border-zinc-200 p-3">
          <div className="relative min-w-0 flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches[0]) addPart(matches[0]);
                }
              }}
              placeholder="Search parts by name or SKU"
              aria-label="Search parts"
              className={`${inputClass} mt-0! pl-9`}
            />
          </div>
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="inline-flex h-9.5 shrink-0 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <Icon name="scan" className="h-4 w-4" />
            <span className="hidden sm:inline">Scan</span>
          </button>
        </div>
        {notice && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-800">{notice}</p>}
        {scanning && <BarcodeScanner onScan={onScan} onClose={() => setScanning(false)} />}

        <ul className="grid gap-px bg-zinc-100 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          {matches.map((p) => {
            const inCart = lines.find((l) => l.part_id === p.id)?.quantity ?? 0;
            return (
              <li key={p.id} className="bg-white">
                <button type="button" onClick={() => addPart(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500">
                    <Icon name="package" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900">{p.name}</span>
                    <span className={`block text-xs ${p.stock_qty <= 0 ? "text-red-600" : "text-zinc-500"}`}>
                      {p.sku ? `${p.sku} · ` : ""}
                      {p.stock_qty} in stock
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block whitespace-nowrap text-sm font-medium tabular text-zinc-900">{p.unit_price != null ? money(Number(p.unit_price)) : "—"}</span>
                    {inCart > 0 && <span className="text-[11px] font-medium text-brand-600">{inCart} in sale</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {matches.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-zinc-400">No parts match &quot;{query}&quot;.</p>}
        <div className="border-t border-zinc-200 p-3">
          <button type="button" onClick={addCustom} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900">
            <Icon name="plus" className="h-4 w-4" />
            Add an item that isn&apos;t in stock list
          </button>
        </div>
      </div>

      {/* Right: the sale */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex h-11 items-center justify-between border-b border-zinc-200 px-4">
            <h2 className="text-sm font-semibold text-zinc-900">This sale</h2>
            {lines.length > 0 && (
              <button type="button" onClick={() => setLines([])} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                Clear
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <Icon name="receipt" className="h-5 w-5" />
              </span>
              <p className="mt-2 text-[13px] text-zinc-500">Tap a part to add it, or scan its barcode.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {lines.map((l) => {
                const lineTotal = l.quantity * (Number(l.unit_price) || 0);
                const short = l.stock !== null && l.quantity > l.stock;
                return (
                  <li key={l.key} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {l.part_id ? (
                        <p className="min-w-0 flex-1 text-sm font-medium text-zinc-900">{l.description}</p>
                      ) : (
                        <input
                          value={l.description}
                          onChange={(e) => update(l.key, { description: e.target.value })}
                          placeholder="Item description"
                          aria-label="Item description"
                          className={`${inputClass} mt-0! h-8 flex-1 py-1 text-sm`}
                          autoFocus
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setLines((c) => c.filter((x) => x.key !== l.key))}
                        aria-label="Remove item"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        <Icon name="x" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="inline-flex items-center rounded-md border border-zinc-300">
                        <button
                          type="button"
                          onClick={() => (l.quantity > 1 ? update(l.key, { quantity: l.quantity - 1 }) : setLines((c) => c.filter((x) => x.key !== l.key)))}
                          aria-label="Decrease quantity"
                          className="flex h-8 w-8 items-center justify-center text-zinc-600 hover:bg-zinc-50"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-medium tabular">{l.quantity}</span>
                        <button
                          type="button"
                          onClick={() => update(l.key, { quantity: l.quantity + 1 })}
                          aria-label="Increase quantity"
                          className="flex h-8 w-8 items-center justify-center text-zinc-600 hover:bg-zinc-50"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-zinc-400">×</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.unit_price}
                        onChange={(e) => update(l.key, { unit_price: e.target.value })}
                        placeholder="Price"
                        aria-label="Unit price"
                        className={`${inputClass} mt-0! h-8 w-20 py-1 text-sm`}
                      />
                      <span className="ml-auto whitespace-nowrap text-sm font-medium tabular text-zinc-900">{money(lineTotal)}</span>
                    </div>
                    {short && <p className="mt-1 text-xs text-amber-700">Only {l.stock} in stock — stock will go below zero.</p>}
                  </li>
                );
              })}
            </ul>
          )}

          <dl className="space-y-1 border-t border-zinc-200 px-4 py-3 text-[13px]">
            <div className="flex justify-between text-zinc-600">
              <dt>Subtotal</dt>
              <dd className="tabular">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-zinc-600">
              <dt>VAT {vatRate}%</dt>
              <dd className="tabular">{money(vat)}</dd>
            </div>
            <div className="flex justify-between pt-1 text-base font-semibold text-zinc-900">
              <dt>Total</dt>
              <dd className="tabular">{money(total)}</dd>
            </div>
          </dl>

          <div className="space-y-3 border-t border-zinc-200 px-4 py-3">
            <div>
              <span className={labelClass}>Paid by</span>
              <div className="grid grid-cols-4 gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    aria-pressed={method === m.value}
                    className={`h-8 rounded text-[13px] font-medium ${method === m.value ? "bg-white text-zinc-900 shadow-[0_0_0_1px_rgb(228,228,231)]" : "text-zinc-500 hover:text-zinc-900"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {showCustomer ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={labelClass}>Name</span>
                  <input name="customer_name" className={inputClass} placeholder="Optional" />
                </label>
                <label className="block">
                  <span className={labelClass}>Mobile</span>
                  <input name="customer_phone" type="tel" className={inputClass} placeholder="05X XXX XXXX" />
                </label>
                <p className="col-span-2 text-xs text-zinc-500">With a mobile number the sale goes on that customer&apos;s account.</p>
              </div>
            ) : (
              <button type="button" onClick={() => setShowCustomer(true)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900">
                <Icon name="user" className="h-4 w-4" />
                Add customer name (optional)
              </button>
            )}

            <PrimaryButton type="submit" icon="check" className="h-11! w-full" disabled={!ready}>
              {ready ? `Complete sale · ${money(total)}` : "Complete sale"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </form>
  );
}
