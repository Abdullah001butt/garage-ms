"use client";

import { Fragment, useRef, useState } from "react";
import type { Part } from "@/lib/types";
import { Badge, EmptyState, Field, SecondaryButton } from "@/components/ui";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export function InventoryTable({
  parts,
  adjustStock,
  createPurchaseOrder,
  updatePartSupplier,
  updatePart,
  deletePart,
}: {
  parts: Part[];
  adjustStock: (partId: string, formData: FormData) => void;
  createPurchaseOrder: (partId: string, formData: FormData) => void;
  updatePartSupplier: (partId: string, formData: FormData) => void;
  updatePart: (partId: string, formData: FormData) => void;
  deletePart: (partId: string) => Promise<void>;
}) {
  const [showScanner, setShowScanner] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  function handleScan(text: string) {
    setShowScanner(false);
    const match = parts.find((p) => p.sku && p.sku.toLowerCase() === text.trim().toLowerCase());
    if (match) {
      setHighlightId(match.id);
      setScanMessage(`Found: ${match.name}`);
      rowRefs.current[match.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightId(null), 3000);
    } else {
      setScanMessage(`No part found with SKU "${text.trim()}"`);
    }
  }

  return (
    <>
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      <div className="mb-3 flex items-center gap-3">
        <SecondaryButton type="button" onClick={() => setShowScanner(true)}>
          📷 Scan to Find
        </SecondaryButton>
        {scanMessage && <span className="text-xs text-slate-500">{scanMessage}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium text-right">Stock</th>
              <th className="px-4 py-2.5 font-medium text-right">Cost</th>
              <th className="px-4 py-2.5 font-medium text-right">Price</th>
              <th className="px-4 py-2.5 font-medium">Supplier</th>
              <th className="px-4 py-2.5 font-medium">Update Stock</th>
              <th className="px-4 py-2.5 font-medium">Reorder</th>
              <th className="px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parts.map((part) => {
              const isLow = part.stock_qty <= part.reorder_threshold;
              return (
                <Fragment key={part.id}>
                <tr
                  ref={(el) => {
                    rowRefs.current[part.id] = el;
                  }}
                  className={highlightId === part.id ? "bg-indigo-50 transition-colors" : ""}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900">{part.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{part.sku ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {isLow ? <Badge color="red">{part.stock_qty} low</Badge> : part.stock_qty}
                  </td>
                  <td className="px-4 py-2.5 text-right">{part.unit_cost?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{part.unit_price?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {editingSupplierId === part.id ? (
                      <form
                        action={(fd) => {
                          updatePartSupplier(part.id, fd);
                          setEditingSupplierId(null);
                        }}
                        className="flex flex-col gap-1"
                      >
                        <input
                          type="text"
                          name="supplier_name"
                          defaultValue={part.supplier_name ?? ""}
                          placeholder="Supplier name"
                          className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          name="supplier_phone"
                          defaultValue={part.supplier_phone ?? ""}
                          placeholder="Phone"
                          className="w-32 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        />
                        <div className="flex gap-1">
                          <button type="submit" className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100">
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSupplierId(null)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {part.supplier_name ? (
                          <>
                            <span className="text-slate-700">{part.supplier_name}</span>
                            {part.supplier_phone && (
                              <a
                                href={buildWhatsAppLink(
                                  part.supplier_phone,
                                  `Hi ${part.supplier_name}, we'd like to restock "${part.name}"${part.sku ? ` (SKU ${part.sku})` : ""} at Al Bahir Garage. Please let us know availability and price.`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-600 hover:underline"
                              >
                                WhatsApp
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingSupplierId(part.id)}
                          className="text-left text-xs text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <form action={adjustStock.bind(null, part.id)} className="flex gap-2">
                      <input
                        type="number"
                        name="stock_qty"
                        defaultValue={part.stock_qty}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2.5">
                    <form action={createPurchaseOrder.bind(null, part.id)} className="flex gap-2">
                      <input
                        type="number"
                        name="quantity"
                        placeholder="Qty"
                        defaultValue={isLow ? Math.max(part.reorder_threshold * 2, 10) : ""}
                        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                      >
                        Order
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingPartId(editingPartId === part.id ? null : part.id)}
                        className="text-left text-xs text-indigo-600 hover:underline"
                      >
                        Edit
                      </button>
                      <ConfirmSubmitButton
                        action={deletePart.bind(null, part.id)}
                        confirmMessage={`Delete part "${part.name}"? This cannot be undone.`}
                        successMessage="Part deleted."
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </div>
                  </td>
                </tr>
                {editingPartId === part.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={8} className="px-4 py-3">
                      <form
                        action={(fd) => {
                          updatePart(part.id, fd);
                          setEditingPartId(null);
                        }}
                        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                      >
                        <Field label="Name" name="name" defaultValue={part.name} required />
                        <Field label="SKU" name="sku" defaultValue={part.sku ?? ""} />
                        <Field label="Reorder Threshold" name="reorder_threshold" type="number" defaultValue={part.reorder_threshold} />
                        <Field label="Unit Cost" name="unit_cost" type="number" step="0.01" defaultValue={part.unit_cost ?? ""} />
                        <Field label="Unit Price" name="unit_price" type="number" step="0.01" defaultValue={part.unit_price ?? ""} />
                        <div className="flex items-end gap-2">
                          <button type="submit" className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-100">
                            Save Part
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPartId(null)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {parts.length === 0 && <EmptyState message="No parts yet." />}
      </div>
    </>
  );
}
