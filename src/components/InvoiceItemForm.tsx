"use client";

import { useState } from "react";
import type { Part } from "@/lib/types";
import { inputClass, labelClass, PrimaryButton, SecondaryButton } from "@/components/ui";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export function InvoiceItemForm({
  parts,
  action,
}: {
  parts: Part[];
  action: (formData: FormData) => void;
}) {
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [itemType, setItemType] = useState("part");
  const [partId, setPartId] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

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
      setScanMessage(`Matched: ${match.name}`);
    } else {
      setScanMessage(`No part found with SKU "${text.trim()}"`);
    }
  }

  return (
    <form action={action} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}
      {parts.length > 0 && (
        <label className="block col-span-2">
          <span className={labelClass}>Use existing part (optional)</span>
          <div className="flex gap-2">
            <select
              value={partId}
              onChange={(e) => handlePartSelect(e.target.value)}
              className={inputClass}
            >
              <option value="">Custom line item...</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(${p.sku})` : ""} — stock {p.stock_qty}
                </option>
              ))}
            </select>
            <SecondaryButton type="button" onClick={() => setShowScanner(true)}>
              📷 Scan
            </SecondaryButton>
          </div>
          {scanMessage && <span className="mt-1 block text-xs text-slate-500">{scanMessage}</span>}
        </label>
      )}
      <input type="hidden" name="part_id" value={partId} />

      <label className="block col-span-2">
        <span className={labelClass}>Description</span>
        <input
          type="text"
          name="description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Type</span>
        <select
          name="item_type"
          value={itemType}
          onChange={(e) => setItemType(e.target.value)}
          className={inputClass}
        >
          <option value="part">Part</option>
          <option value="labor">Labor</option>
          <option value="service">Service (towing, recovery, etc.)</option>
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>Quantity</span>
        <input type="number" name="quantity" step="0.01" defaultValue={1} required className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Unit Price (AED)</span>
        <input
          type="number"
          name="unit_price"
          step="0.01"
          required
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className={labelClass}>Warranty (days, optional)</span>
        <input
          type="number"
          name="warranty_days"
          placeholder="e.g. 90"
          className={inputClass}
        />
      </label>
      <div className="col-span-2">
        <PrimaryButton type="submit">Add Item</PrimaryButton>
      </div>
    </form>
  );
}
