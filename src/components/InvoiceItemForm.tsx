"use client";

import { useState } from "react";
import type { Part } from "@/lib/types";
import { inputClass, labelClass, PrimaryButton, SecondaryButton } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { BarcodeScanner } from "@/components/BarcodeScanner";

const TYPES: { value: "part" | "labor" | "service"; label: string; icon: IconName }[] = [
  { value: "part", label: "Part", icon: "package" },
  { value: "labor", label: "Labour", icon: "wrench" },
  { value: "service", label: "Service", icon: "car" },
];

export function InvoiceItemForm({
  parts,
  action,
}: {
  parts: Part[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [itemType, setItemType] = useState<"part" | "labor" | "service">("part");
  const [partId, setPartId] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const selectedPart = parts.find((p) => p.id === partId);
  const lineTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  function handlePartSelect(id: string) {
    setPartId(id);
    const part = parts.find((p) => p.id === id);
    if (part) {
      setDescription(part.name);
      setUnitPrice(String(part.unit_price ?? ""));
      setItemType("part");
    }
  }

  function handleScan(text: string) {
    setShowScanner(false);
    const match = parts.find((p) => p.sku && p.sku.toLowerCase() === text.trim().toLowerCase());
    if (match) {
      handlePartSelect(match.id);
      setScanMessage(`Matched ${match.name}`);
    } else {
      setScanMessage(`No part found with SKU "${text.trim()}"`);
    }
  }

  function reset() {
    setDescription("");
    setUnitPrice("");
    setQuantity("1");
    setPartId("");
    setScanMessage(null);
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        reset();
      }}
      className="space-y-4"
    >
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      <input type="hidden" name="item_type" value={itemType} />
      <input type="hidden" name="part_id" value={itemType === "part" ? partId : ""} />

      <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5" role="radiogroup" aria-label="Item type">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={itemType === t.value}
            onClick={() => {
              setItemType(t.value);
              if (t.value !== "part") setPartId("");
            }}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1 text-[13px] font-medium transition-colors ${
              itemType === t.value ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {itemType === "part" && parts.length > 0 && (
        <div>
          <span className={labelClass}>From parts stock (optional)</span>
          <div className="flex gap-2">
            <select value={partId} onChange={(e) => handlePartSelect(e.target.value)} className={inputClass}>
              <option value="">Custom part…</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` · ${p.sku}` : ""} — {p.stock_qty} in stock
                </option>
              ))}
            </select>
            <SecondaryButton type="button" icon="scan" onClick={() => setShowScanner(true)}>
              Scan
            </SecondaryButton>
          </div>
          {scanMessage && <span className="mt-1.5 block text-xs text-zinc-500">{scanMessage}</span>}
          {selectedPart && selectedPart.stock_qty <= selectedPart.reorder_threshold && (
            <span className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
              <Icon name="alert" className="h-3.5 w-3.5" />
              Only {selectedPart.stock_qty} left in stock
            </span>
          )}
        </div>
      )}

      <label className="block">
        <span className={labelClass}>Description</span>
        <input
          type="text"
          name="description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={itemType === "labor" ? "e.g. Brake pad replacement labour" : itemType === "service" ? "e.g. Recovery / towing" : "e.g. Engine oil 5W-30"}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className={labelClass}>Qty</span>
          <input type="number" name="quantity" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className={`${inputClass} tabular`} />
        </label>
        <label className="block">
          <span className={labelClass}>Unit price (AED)</span>
          <input type="number" name="unit_price" step="0.01" min="0" required value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={`${inputClass} tabular`} />
        </label>
        <div>
          <span className={labelClass}>Line total</span>
          <p className="flex h-9.5 items-center rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-zinc-900 tabular">
            AED {lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <label className="block">
          <span className={labelClass}>Warranty (days)</span>
          <input type="number" name="warranty_days" min="0" placeholder="Optional" className={`${inputClass} tabular`} />
        </label>
      </div>

      <div className="flex justify-end border-t border-zinc-100 pt-4">
        <PrimaryButton type="submit" icon="plus">
          Add line item
        </PrimaryButton>
      </div>
    </form>
  );
}
