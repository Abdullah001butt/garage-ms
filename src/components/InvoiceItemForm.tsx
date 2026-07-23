"use client";

import { useState } from "react";
import type { Part } from "@/lib/types";
import { inputClass, labelClass, PrimaryButton } from "@/components/ui";

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

  function handlePartSelect(id: string) {
    setPartId(id);
    const part = parts.find((p) => p.id === id);
    if (part) {
      setDescription(part.name);
      setUnitPrice(String(part.unit_price ?? ""));
      setItemType("part");
    }
  }

  return (
    <form action={action} className="grid grid-cols-2 gap-4 mt-4">
      {parts.length > 0 && (
        <label className="block col-span-2">
          <span className={labelClass}>Use existing part (optional)</span>
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
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>Quantity</span>
        <input type="number" name="quantity" step="0.01" defaultValue={1} required className={inputClass} />
      </label>
      <label className="block col-span-2">
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
      <div className="col-span-2">
        <PrimaryButton type="submit">Add Item</PrimaryButton>
      </div>
    </form>
  );
}
